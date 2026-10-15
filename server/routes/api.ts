import { Router } from 'express';
import crypto from 'node:crypto';
import { dbService } from '../db/index.js';
import { computeProductPricing, computeBulkUnitPrice, getPricingEngineContext } from '../services/pricing.js';
import { paymentAdapter } from '../payments/adapter.js';
import { insightXProClient, extractSupplierFulfilment } from '../supplier/insightxpro.js';
import type { Product, PricingRule, Order, Customer, Delivery, OrderItem } from '../db/types.js';

export const apiRouter = Router();

// System config & public policy
apiRouter.get('/config', async (req, res) => {
  try {
    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const paymentModeSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'payment_mode'`
    );
    const syncSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'catalogue_last_synced'`
    );
    const syncErrorSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'catalogue_last_sync_error'`
    );

    res.json({
      marketplace_name: 'ToolPadi',
      tagline: 'Your digital tools, within reach.',
      core_message: 'Powerful tools. Prices that work for you.',
      usd_ngn_rate: Number(rateSetting?.value || 1450),
      payment_mode: paymentModeSetting?.value || 'sandbox_simulator',
      is_live_payment: paymentModeSetting?.value === 'paystack_live',
      catalogue_last_synced: syncSetting?.value || null,
      catalogue_last_sync_error: syncErrorSetting?.value || null,
      supplier_configured: insightXProClient.isConfigured(),
      disclaimer: 'ToolPadi is a proposed name pending business-name, trademark, domain, and social-handle validation. Products are strictly sourced via authorized supplier synchronization.',
      rounding_policy: 'All NGN prices are rounded to the nearest ₦50 or ₦100 for cash and transfer clarity.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List public customer catalogue products (strictly approved, active, and available)
apiRouter.get('/products', async (req, res) => {
  try {
    const { category, search, access_type, duration } = req.query;

    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const exchangeRate = Number(rateSetting?.value || 1450);
    const pricingOptions = await getPricingEngineContext();

    // Only return products that are published, reseller-approved, and currently available from supplier
    const products = await dbService.query<Product>(`
      SELECT * FROM products
      WHERE is_active = 1 AND reseller_approved = 1 AND is_supplier_available = 1
      ORDER BY created_at DESC
    `);

    const rules = await dbService.query<PricingRule>(`SELECT * FROM pricing_rules`);
    const ruleMap = new Map<string, PricingRule>();
    for (const r of rules) {
      ruleMap.set(r.product_id, r);
    }

    let computed = products.map(p => {
      const rule = ruleMap.get(p.id) || null;
      return computeProductPricing(p, rule, exchangeRate, pricingOptions);
    });

    // Filtering
    if (category && category !== 'All') {
      computed = computed.filter(p => p.category.toLowerCase() === String(category).toLowerCase());
    }

    if (access_type && access_type !== 'All') {
      computed = computed.filter(p => p.access_type === access_type);
    }

    if (duration && duration !== 'All') {
      computed = computed.filter(p => p.duration === duration);
    }

    if (search && String(search).trim().length > 0) {
      const query = String(search).toLowerCase();
      computed = computed.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.short_description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      );
    }

    res.json({
      products: computed,
      total: computed.length,
      exchange_rate: exchangeRate,
      supplier_configured: insightXProClient.isConfigured()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single product detail by slug
apiRouter.get('/products/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await dbService.queryOne<Product>(`
      SELECT * FROM products WHERE slug = ?
    `, [slug]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const rule = await dbService.queryOne<PricingRule>(`
      SELECT * FROM pricing_rules WHERE product_id = ?
    `, [product.id]);

    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const exchangeRate = Number(rateSetting?.value || 1450);
    const pricingOptions = await getPricingEngineContext();

    const computed = computeProductPricing(product, rule, exchangeRate, pricingOptions);

    res.json({
      product: computed,
      exchange_rate: exchangeRate
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cart verification endpoint (checks price freshness, authorization & stock)
apiRouter.post('/cart/validate', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid items array.' });
    }

    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const exchangeRate = Number(rateSetting?.value || 1450);
    const pricingOptions = await getPricingEngineContext();

    const validatedItems = [];
    let hasIssues = false;

    for (const item of items) {
      const product = await dbService.queryOne<Product>(`
        SELECT * FROM products WHERE id = ?
      `, [item.product_id]);

      if (!product) {
        validatedItems.push({
          product_id: item.product_id,
          valid: false,
          issue: 'Product no longer exists in catalogue.'
        });
        hasIssues = true;
        continue;
      }

      const rule = await dbService.queryOne<PricingRule>(`
        SELECT * FROM pricing_rules WHERE product_id = ?
      `, [product.id]);

      const computed = computeProductPricing(product, rule, exchangeRate, pricingOptions);

      const qty = Math.max(1, Number(item.quantity || 1));

      if (!computed.can_purchase) {
        validatedItems.push({
          product_id: item.product_id,
          title: product.title,
          valid: false,
          issue: computed.block_reason || 'Product is currently not available for purchase.'
        });
        hasIssues = true;
      } else if (product.max_order_quantity && product.max_order_quantity > 0 && qty > product.max_order_quantity) {
        validatedItems.push({
          product_id: item.product_id,
          title: product.title,
          valid: false,
          issue: `Maximum allowable order quantity for "${product.title}" is ${product.max_order_quantity} units.`
        });
        hasIssues = true;
      } else if (product.is_unlimited !== 1 && product.stock_count < qty) {
        validatedItems.push({
          product_id: item.product_id,
          title: product.title,
          valid: false,
          issue: `Insufficient stock from supplier. Only ${product.stock_count} units available.`
        });
        hasIssues = true;
      } else {
        const bulkCalc = computeBulkUnitPrice({
          baseRetailNgn: computed.retail_price_ngn,
          baseRetailUsd: computed.retail_price_usd,
          supplierCostNgn: product.supplier_cost_ngn,
          quantity: qty,
          bulkPricing: computed.bulk_pricing,
          exchangeRate,
          roundingRule: pricingOptions.roundingRule
        });

        validatedItems.push({
          product_id: item.product_id,
          title: product.title,
          valid: true,
          unit_price_ngn: bulkCalc.effective_unit_price_ngn,
          unit_price_usd: bulkCalc.effective_unit_price_usd,
          base_price_ngn: bulkCalc.base_unit_price_ngn,
          base_price_usd: bulkCalc.base_unit_price_usd,
          total_line_ngn: bulkCalc.total_ngn,
          total_line_usd: bulkCalc.total_usd,
          savings_ngn: bulkCalc.total_savings_ngn,
          savings_usd: bulkCalc.total_savings_usd,
          discount_percent: bulkCalc.discount_percent,
          is_bulk_applied: bulkCalc.is_bulk_applied,
          tier_label: bulkCalc.tier_label,
          quantity: qty
        });
      }
    }

    res.json({
      valid: !hasIssues,
      items: validatedItems,
      exchange_rate: exchangeRate
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Checkout & order creation
apiRouter.post('/checkout', async (req, res) => {
  try {
    const {
      email,
      full_name,
      phone,
      currency = 'NGN',
      items,
      channel = 'bank_transfer',
      idempotency_key
    } = req.body;

    if (!email || !full_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required checkout information.' });
    }

    const key = idempotency_key || `idem-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const existingOrder = await dbService.queryOne<Order>(`
      SELECT * FROM orders WHERE idempotency_key = ?
    `, [key]);

    if (existingOrder) {
      const paymentInfo = await paymentAdapter.initializePayment({
        order_reference: existingOrder.order_reference,
        amount: existingOrder.total_amount,
        currency: existingOrder.currency,
        customer_email: existingOrder.customer_email,
        customer_name: existingOrder.customer_name,
        channel
      });

      return res.json({
        order_reference: existingOrder.order_reference,
        order: existingOrder,
        payment: paymentInfo,
        reused_idempotency: true
      });
    }

    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const exchangeRate = Number(rateSetting?.value || 1450);
    const pricingOptions = await getPricingEngineContext();

    let totalNgn = 0;
    let totalUsd = 0;
    const verifiedOrderItems: any[] = [];

    for (const item of items) {
      const product = await dbService.queryOne<Product>(`
        SELECT * FROM products WHERE id = ?
      `, [item.product_id]);

      if (!product) {
        return res.status(400).json({ error: `Product ID ${item.product_id} is not valid.` });
      }

      const rule = await dbService.queryOne<PricingRule>(`
        SELECT * FROM pricing_rules WHERE product_id = ?
      `, [product.id]);

      const computed = computeProductPricing(product, rule, exchangeRate, pricingOptions);

      if (!computed.can_purchase) {
        return res.status(400).json({
          error: `Cannot purchase "${product.title}": ${computed.block_reason}`
        });
      }

      const qty = Math.max(1, Number(item.quantity || 1));
      if (product.max_order_quantity && product.max_order_quantity > 0 && qty > product.max_order_quantity) {
        return res.status(400).json({
          error: `Order quantity for "${product.title}" exceeds maximum permitted limit (${product.max_order_quantity} units per order).`
        });
      }

      if (product.is_unlimited !== 1 && product.stock_count < qty) {
        return res.status(400).json({
          error: `Insufficient stock for "${product.title}". Requested ${qty}, but only ${product.stock_count} units available from supplier.`
        });
      }

      const bulkCalc = computeBulkUnitPrice({
        baseRetailNgn: computed.retail_price_ngn,
        baseRetailUsd: computed.retail_price_usd,
        supplierCostNgn: product.supplier_cost_ngn,
        quantity: qty,
        bulkPricing: computed.bulk_pricing,
        exchangeRate,
        roundingRule: pricingOptions.roundingRule
      });

      totalNgn += bulkCalc.total_ngn;
      totalUsd += bulkCalc.total_usd;

      const authoritativeUnitPrice = currency === 'USD' ? bulkCalc.effective_unit_price_usd : bulkCalc.effective_unit_price_ngn;
      const unitSupplierCost = currency === 'USD' ? product.supplier_cost_usdt : product.supplier_cost_ngn;

      verifiedOrderItems.push({
        product_id: product.id,
        product_title: product.title,
        unit_price: authoritativeUnitPrice,
        supplier_cost: unitSupplierCost,
        quantity: qty,
        access_type: product.access_type,
        duration: product.duration,
        tier_applied: bulkCalc.tier_applied ? bulkCalc.tier_label : null
      });
    }

    const finalTotal = currency === 'USD' ? Math.round(totalUsd * 100) / 100 : totalNgn;

    let customer = await dbService.queryOne<Customer>(`
      SELECT * FROM customers WHERE email = ?
    `, [email.toLowerCase().trim()]);

    const now = new Date().toISOString();
    if (!customer) {
      const customerId = `cust-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await dbService.run(`
        INSERT INTO customers (id, email, full_name, phone, currency_preference, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [customerId, email.toLowerCase().trim(), full_name.trim(), phone || null, currency, now]);

      customer = {
        id: customerId,
        email: email.toLowerCase().trim(),
        full_name: full_name.trim(),
        phone: phone || null,
        currency_preference: currency,
        created_at: now
      };
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderReference = `TP-${new Date().getFullYear()}-${randomSuffix}`;
    const orderId = `ord-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    await dbService.run(`
      INSERT INTO orders (
        id, order_reference, customer_id, customer_email, customer_name, customer_phone,
        total_amount, currency, exchange_rate, payment_status, fulfilment_status, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unfulfilled', ?, ?, ?)
    `, [
      orderId,
      orderReference,
      customer.id,
      customer.email,
      customer.full_name,
      customer.phone,
      finalTotal,
      currency,
      exchangeRate,
      key,
      now,
      now
    ]);

    for (const vi of verifiedOrderItems) {
      await dbService.run(`
        INSERT INTO order_items (
          id, order_id, product_id, product_title, unit_price, supplier_cost, quantity, access_type, duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `item-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        orderId,
        vi.product_id,
        vi.product_title,
        vi.unit_price,
        vi.supplier_cost,
        vi.quantity,
        vi.access_type,
        vi.duration
      ]);
    }

    const paymentInfo = await paymentAdapter.initializePayment({
      order_reference: orderReference,
      amount: finalTotal,
      currency,
      customer_email: customer.email,
      customer_name: customer.full_name,
      channel
    });

    const createdOrder = await dbService.queryOne<Order>(`
      SELECT * FROM orders WHERE id = ?
    `, [orderId]);

    res.json({
      order_reference: orderReference,
      order: createdOrder,
      items: verifiedOrderItems,
      payment: paymentInfo
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verify payment
apiRouter.post('/payments/verify', async (req, res) => {
  try {
    const { order_reference, payment_reference, simulation_channel = 'sandbox' } = req.body;

    if (!order_reference) {
      return res.status(400).json({ error: 'Missing order_reference parameter.' });
    }

    const result = await paymentAdapter.verifyAndFulfill(
      order_reference,
      payment_reference || `PAY-${order_reference}`,
      simulation_channel
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Order lookup by reference
apiRouter.get('/orders/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const requesterEmail = (req.query.email as string) || (req.headers['x-customer-email'] as string);

    const order = await dbService.queryOne<Order>(`
      SELECT * FROM orders WHERE order_reference = ?
    `, [reference]);

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (requesterEmail && String(requesterEmail).trim().toLowerCase() !== order.customer_email.toLowerCase()) {
      return res.status(403).json({ error: "Order email does not match. Unauthorized customer access blocked." });
    }

    const items = await dbService.query(`SELECT * FROM order_items WHERE order_id = ?`, [order.id]);
    const deliveries = await dbService.query(`SELECT * FROM deliveries WHERE order_id = ?`, [order.id]);
    const transactions = await dbService.query(`
      SELECT id, payment_reference, provider, amount, currency, status, created_at
      FROM payment_transactions WHERE order_id = ?
    `, [order.id]);

    res.json({ order, items, deliveries, transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync order fulfilment status directly from supplier
apiRouter.post('/orders/:reference/sync', async (req, res) => {
  try {
    const { reference } = req.params;
    const order = await dbService.queryOne<Order>(`
      SELECT * FROM orders WHERE order_reference = ?
    `, [reference]);

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const currentDeliveries = await dbService.query<Delivery>(`
      SELECT * FROM deliveries WHERE order_id = ?
    `, [order.id]);

    const items = await dbService.query<OrderItem>(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [order.id]);

    const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);

    // If already fully delivered, return immediately
    if (order.fulfilment_status === 'fulfilled' && currentDeliveries.length >= totalQty) {
      return res.json({
        success: true,
        order,
        deliveries: currentDeliveries,
        message: 'Order is completely fulfilled.'
      });
    }

    // If order has a supplier_order_id and InsightXPro is configured, query supplier status
    if (order.supplier_order_id && insightXProClient.isConfigured()) {
      try {
        const supplierStatusResp = await insightXProClient.getOrderStatus(order.supplier_order_id);
        const extracted = extractSupplierFulfilment(supplierStatusResp);

        if (extracted.items.length > 0 && currentDeliveries.length < totalQty) {
          const now = new Date().toISOString();
          const firstItem = items[0];

          for (const delItem of extracted.items) {
            // Check if already inserted
            const alreadyExists = currentDeliveries.some(d => d.license_code_or_credential === delItem.delivery_content);
            if (!alreadyExists) {
              await dbService.run(`
                INSERT INTO deliveries (
                  id, order_id, order_item_id, delivery_type, delivery_format,
                  license_code_or_credential, redemption_url, supplier_order_id, raw_code_or_link,
                  delivery_status, instructions, access_expires_at, delivered_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'delivered', ?, ?, ?)
              `, [
                `del-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
                order.id,
                firstItem ? firstItem.id : 'unknown',
                firstItem ? firstItem.access_type : 'digital_access',
                delItem.delivery_format,
                delItem.delivery_content,
                delItem.redemption_url || null,
                extracted.supplier_order_id,
                delItem.delivery_content,
                delItem.instructions,
                null,
                now
              ]);
            }
          }

          const freshDeliveries = await dbService.query<Delivery>(`
            SELECT * FROM deliveries WHERE order_id = ?
          `, [order.id]);

          const isNowFulfilled = freshDeliveries.length >= totalQty;

          await dbService.run(`
            UPDATE orders
            SET fulfilment_status = ?, supplier_status = ?, updated_at = ?
            WHERE id = ?
          `, [isNowFulfilled ? 'fulfilled' : 'processing', extracted.supplier_status, now, order.id]);

          const refreshedOrder = await dbService.queryOne<Order>(`
            SELECT * FROM orders WHERE id = ?
          `, [order.id]);

          return res.json({
            success: true,
            order: refreshedOrder,
            deliveries: freshDeliveries,
            message: isNowFulfilled
              ? 'Supplier finished processing. Delivered access credentials.'
              : 'Supplier order still in progress.'
          });
        }
      } catch (err: any) {
        console.warn(`[Order Sync] Failed checking supplier order ${order.supplier_order_id}: ${err.message}`);
      }
    }

    const latestDeliveries = await dbService.query<Delivery>(`
      SELECT * FROM deliveries WHERE order_id = ?
    `, [order.id]);

    res.json({
      success: true,
      order,
      deliveries: latestDeliveries,
      message: latestDeliveries.length >= totalQty
        ? 'Order is fulfilled.'
        : 'Order is currently being prepared by the supplier network.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Customer order history by email
apiRouter.get('/customer/orders', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const orders = await dbService.query<Order>(`
      SELECT * FROM orders WHERE LOWER(customer_email) = LOWER(?) ORDER BY created_at DESC
    `, [String(email).trim()]);

    res.json({ orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Support ticket
apiRouter.post('/support/ticket', async (req, res) => {
  try {
    const { customer_email, customer_name, order_reference, subject, category, message } = req.body;

    if (!customer_email || !customer_name || !subject || !message) {
      return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    const ticketId = `tkt-${Date.now()}`;
    const ticketRef = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;

    await dbService.run(`
      INSERT INTO support_tickets (
        id, ticket_reference, order_reference, customer_email, customer_name, subject, category, message, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `, [
      ticketId,
      ticketRef,
      order_reference || null,
      customer_email.trim(),
      customer_name.trim(),
      subject.trim(),
      category || 'question',
      message.trim(),
      new Date().toISOString()
    ]);

    res.json({
      success: true,
      ticket_reference: ticketRef,
      message: 'Your inquiry has been received. Our support team typically responds within 2 business hours.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
