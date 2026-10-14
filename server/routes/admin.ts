import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { dbService } from '../db/index.js';
import { insightXProClient } from '../supplier/insightxpro.js';
import { syncSupplierCatalogue } from '../services/catalogue-sync.js';
import {
  computeProductPricing,
  validatePricingUpdate,
  roundToMarketNaira,
  getPricingEngineContext,
  previewPricingCalculation,
  validateBulkTiers,
  computeBulkUnitPrice
} from '../services/pricing.js';
import { runAllVerificationTests, executeScenarioTest } from '../services/testing-runner.js';
import type { Product, PricingRule, CategoryPricingRule, Order, AuditLog, AdminSetting, BulkPricingTier } from '../db/types.js';

export const adminRouter = Router();

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'TOOLPADI_ADMIN_SECURE_KEY_2026';

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!authHeader || authHeader !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin key.' });
  }
  next();
}

adminRouter.use(requireAdminAuth);

// Admin dashboard summary overview
adminRouter.get('/overview', async (req, res) => {
  try {
    const totalOrdersRes = await dbService.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM orders`);
    const totalRevenueRes = await dbService.queryOne<{ total: number }>(`SELECT SUM(total_amount) as total FROM orders WHERE payment_status = 'paid'`);
    const totalProductsRes = await dbService.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM products`);
    const approvedProductsRes = await dbService.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM products WHERE reseller_approved = 1 AND is_active = 1`);
    const pendingApprovalRes = await dbService.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM products WHERE reseller_approved = 0`);

    const lastSyncSetting = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'catalogue_last_synced'`);
    const lastSyncErrorSetting = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'catalogue_last_sync_error'`);

    const supplierBalance = await insightXProClient.getBalance();

    res.json({
      total_orders: totalOrdersRes?.count || 0,
      total_revenue_ngn: totalRevenueRes?.total || 0,
      total_products: totalProductsRes?.count || 0,
      approved_products: approvedProductsRes?.count || 0,
      pending_approvals: pendingApprovalRes?.count || 0,
      supplier_configured: insightXProClient.isConfigured(),
      catalogue_last_synced: lastSyncSetting?.value || null,
      catalogue_last_sync_error: lastSyncErrorSetting?.value || null,
      supplier_balance: supplierBalance
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all products for management (shows supplier provenance and raw data)
adminRouter.get('/products', async (req, res) => {
  try {
    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const exchangeRate = Number(rateSetting?.value || 1450);
    const pricingOptions = await getPricingEngineContext();

    const products = await dbService.query<Product>(`
      SELECT * FROM products ORDER BY created_at DESC
    `);

    const rules = await dbService.query<PricingRule>(`SELECT * FROM pricing_rules`);
    const ruleMap = new Map<string, PricingRule>();
    for (const r of rules) {
      ruleMap.set(r.product_id, r);
    }

    const computed = products.map(p => {
      const rule = ruleMap.get(p.id) || null;
      return computeProductPricing(p, rule, exchangeRate, pricingOptions);
    });

    res.json({ products: computed, exchange_rate: exchangeRate, pricing_options: pricingOptions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Reseller Authorization Status & Product Visibility & Individual Controls
adminRouter.post('/products/:id/approval', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reseller_approved,
      is_active,
      purchasable_override,
      category,
      access_type,
      duration,
      title,
      short_description,
      description,
      delivery_instructions,
      terms_of_service,
      max_order_quantity,
      bulk_pricing_enabled,
      bulk_pricing_mode,
      reason = 'Administrator product control update'
    } = req.body;

    const current = await dbService.queryOne<Product>(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!current) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const now = new Date().toISOString();
    const newApproved = reseller_approved !== undefined ? (reseller_approved ? 1 : 0) : current.reseller_approved;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : current.is_active;
    const newPurchasable = purchasable_override !== undefined ? (purchasable_override ? 1 : 0) : (current.purchasable_override ?? 1);
    const newCategory = category !== undefined ? category : current.category;
    const newAccessType = access_type !== undefined ? access_type : current.access_type;
    const newDuration = duration !== undefined ? duration : current.duration;
    const newTitle = title !== undefined ? title : current.title;
    const newShortDesc = short_description !== undefined ? short_description : current.short_description;
    const newDesc = description !== undefined ? description : current.description;
    const newDelivery = delivery_instructions !== undefined ? delivery_instructions : current.delivery_instructions;
    const newTerms = terms_of_service !== undefined ? terms_of_service : current.terms_of_service;
    const newMaxQty = max_order_quantity !== undefined ? Math.max(0, Number(max_order_quantity)) : (current.max_order_quantity ?? 0);
    const newBulkEnabled = bulk_pricing_enabled !== undefined ? (bulk_pricing_enabled ? 1 : 0) : (current.bulk_pricing_enabled ?? 0);
    const newBulkMode = bulk_pricing_mode !== undefined ? bulk_pricing_mode : (current.bulk_pricing_mode ?? 'discount_percent');

    await dbService.run(`
      UPDATE products
      SET
        reseller_approved = ?,
        is_active = ?,
        purchasable_override = ?,
        category = ?,
        access_type = ?,
        duration = ?,
        title = ?,
        short_description = ?,
        description = ?,
        delivery_instructions = ?,
        terms_of_service = ?,
        max_order_quantity = ?,
        bulk_pricing_enabled = ?,
        bulk_pricing_mode = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      newApproved,
      newActive,
      newPurchasable,
      newCategory,
      newAccessType,
      newDuration,
      newTitle,
      newShortDesc,
      newDesc,
      newDelivery,
      newTerms,
      newMaxQty,
      newBulkEnabled,
      newBulkMode,
      now,
      id
    ]);

    // Record audit log
    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'ADMIN_USER', 'PRODUCT_CONTROLS_UPDATED', 'product', ?, ?, ?, ?)
    `, [
      `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      id,
      `Updated controls for ${newTitle}. Approved: ${newApproved}, Published: ${newActive}, Purchasable: ${newPurchasable}, Bulk: ${newBulkEnabled}. Reason: ${reason}`,
      req.ip || '127.0.0.1',
      now
    ]);

    res.json({
      success: true,
      message: `Product controls updated successfully. Approved: ${newApproved === 1}, Storefront: ${newActive === 1}, Purchasable: ${newPurchasable === 1}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Alias for controls endpoint
adminRouter.post('/products/:id/controls', async (req, res, next) => {
  return (adminRouter as any).handle(Object.assign(req, { url: `/products/${req.params.id}/approval` }), res, next);
});

// Fetch product bulk pricing configuration and tiers
adminRouter.get('/products/:id/bulk-pricing', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await dbService.queryOne<Product>(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const tiers = await dbService.query<BulkPricingTier>(`
      SELECT * FROM product_bulk_pricing_tiers WHERE product_id = ? ORDER BY min_quantity ASC
    `, [id]);

    const rateSetting = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`);
    const exchangeRate = Number(rateSetting?.value || 1450);
    const pricingOptions = await getPricingEngineContext();
    const rule = await dbService.queryOne<PricingRule>(`SELECT * FROM pricing_rules WHERE product_id = ?`, [id]);
    const computed = computeProductPricing(product, rule, exchangeRate, pricingOptions);

    res.json({
      product_id: product.id,
      title: product.title,
      supplier_cost_ngn: product.supplier_cost_ngn,
      supplier_cost_usdt: product.supplier_cost_usdt,
      base_retail_price_ngn: computed.retail_price_ngn,
      base_retail_price_usd: computed.retail_price_usd,
      bulk_pricing_enabled: product.bulk_pricing_enabled === 1,
      bulk_pricing_mode: product.bulk_pricing_mode || 'discount_percent',
      max_order_quantity: product.max_order_quantity || 0,
      tiers: tiers || [],
      exchange_rate: exchangeRate
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save product bulk pricing configuration and tiers
adminRouter.post('/products/:id/bulk-pricing', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      enabled,
      mode = 'discount_percent',
      max_order_quantity = 0,
      tiers = [],
      allow_unprofitable = false,
      reason = 'Administrator updated bulk pricing configuration'
    } = req.body;

    const product = await dbService.queryOne<Product>(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Validate tiers
    if (enabled && tiers.length > 0) {
      const validation = validateBulkTiers(tiers, mode, product.supplier_cost_ngn, Boolean(allow_unprofitable));
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const now = new Date().toISOString();
    const isEnabled = enabled ? 1 : 0;
    const maxQty = Math.max(0, Number(max_order_quantity) || 0);

    // Update product table bulk configuration
    await dbService.run(`
      UPDATE products
      SET
        bulk_pricing_enabled = ?,
        bulk_pricing_mode = ?,
        max_order_quantity = ?,
        updated_at = ?
      WHERE id = ?
    `, [isEnabled, mode, maxQty, now, id]);

    // Replace tiers atomically
    await dbService.run(`DELETE FROM product_bulk_pricing_tiers WHERE product_id = ?`, [id]);

    if (isEnabled && Array.isArray(tiers)) {
      const sortedTiers = [...tiers].sort((a, b) => Number(a.min_quantity) - Number(b.min_quantity));
      for (let i = 0; i < sortedTiers.length; i++) {
        const t = sortedTiers[i];
        const tierId = `bpt-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        const minQ = Math.max(1, Number(t.min_quantity));
        const maxQ = t.max_quantity && Number(t.max_quantity) > 0 ? Number(t.max_quantity) : null;
        const discPct = Number(t.discount_percentage ?? 0);
        const fixedNgn = Number(t.fixed_unit_price_ngn ?? 0);
        const fixedUsd = Number(t.fixed_unit_price_usd ?? 0);

        await dbService.run(`
          INSERT INTO product_bulk_pricing_tiers (
            id, product_id, tier_order, min_quantity, max_quantity,
            discount_percentage, fixed_unit_price_ngn, fixed_unit_price_usd,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tierId,
          id,
          i + 1,
          minQ,
          maxQ,
          discPct,
          fixedNgn,
          fixedUsd,
          now,
          now
        ]);
      }
    }

    // Audit log
    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'ADMIN_USER', 'BULK_PRICING_UPDATED', 'product', ?, ?, ?, ?)
    `, [
      `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      id,
      `Bulk pricing ${isEnabled ? 'enabled' : 'disabled'} for ${product.title} (Mode: ${mode}, Tiers: ${tiers.length}). Reason: ${reason}`,
      req.ip || '127.0.0.1',
      now
    ]);

    res.json({
      success: true,
      message: `Bulk pricing configuration saved successfully for "${product.title}".`,
      enabled: isEnabled === 1,
      mode,
      tiers_count: tiers.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Preview bulk pricing calculations
adminRouter.post('/bulk-pricing/preview', async (req, res) => {
  try {
    const {
      product_id,
      base_retail_price_ngn,
      base_retail_price_usd,
      supplier_cost_ngn,
      mode = 'discount_percent',
      tiers = []
    } = req.body;

    let baseNgn = Number(base_retail_price_ngn || 0);
    let baseUsd = Number(base_retail_price_usd || 0);
    let costNgn = Number(supplier_cost_ngn || 0);

    const rateSetting = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`);
    const exchangeRate = Number(rateSetting?.value || 1450);

    if (product_id) {
      const product = await dbService.queryOne<Product>(`SELECT * FROM products WHERE id = ?`, [product_id]);
      if (product) {
        costNgn = product.supplier_cost_ngn;
        const rule = await dbService.queryOne<PricingRule>(`SELECT * FROM pricing_rules WHERE product_id = ?`, [product_id]);
        const computed = computeProductPricing(product, rule, exchangeRate);
        baseNgn = computed.retail_price_ngn;
        baseUsd = computed.retail_price_usd;
      }
    }

    if (baseNgn <= 0) {
      baseNgn = 10000;
      baseUsd = Math.round((baseNgn / exchangeRate) * 100) / 100;
    }

    const validation = validateBulkTiers(tiers, mode, costNgn, true);

    const previews = tiers.map((tier: any, idx: number) => {
      const minQ = Number(tier.min_quantity || 1);
      const maxQ = tier.max_quantity && Number(tier.max_quantity) > 0 ? Number(tier.max_quantity) : null;
      const sampleQty = minQ;

      let unitPriceNgn = baseNgn;
      let unitPriceUsd = baseUsd;
      let discountPct = 0;

      if (mode === 'discount_percent') {
        discountPct = Number(tier.discount_percentage || 0);
        unitPriceNgn = roundToMarketNaira(baseNgn * (1 - discountPct / 100));
        unitPriceUsd = Math.round((baseUsd * (1 - discountPct / 100)) * 100) / 100;
      } else {
        unitPriceNgn = roundToMarketNaira(Number(tier.fixed_unit_price_ngn || baseNgn));
        unitPriceUsd = tier.fixed_unit_price_usd > 0
          ? Number(tier.fixed_unit_price_usd)
          : Math.round((unitPriceNgn / exchangeRate) * 100) / 100;
        discountPct = baseNgn > 0
          ? Math.max(0, Math.round(((baseNgn - unitPriceNgn) / baseNgn) * 1000) / 10)
          : 0;
      }

      const totalLineNgn = unitPriceNgn * sampleQty;
      const standardTotalNgn = baseNgn * sampleQty;
      const savingsNgn = Math.max(0, standardTotalNgn - totalLineNgn);
      const unitProfitNgn = unitPriceNgn - costNgn;
      const isUnprofitable = costNgn > 0 && unitPriceNgn < costNgn;
      const marginPct = unitPriceNgn > 0 ? Math.round((unitProfitNgn / unitPriceNgn) * 1000) / 10 : 0;

      return {
        tier_index: idx + 1,
        min_quantity: minQ,
        max_quantity: maxQ,
        range_label: maxQ ? `${minQ}–${maxQ} units` : `${minQ}+ units`,
        discount_percentage: discountPct,
        unit_price_ngn: unitPriceNgn,
        unit_price_usd: unitPriceUsd,
        sample_quantity: sampleQty,
        sample_total_ngn: totalLineNgn,
        sample_savings_ngn: savingsNgn,
        unit_profit_ngn: unitProfitNgn,
        margin_percent: marginPct,
        is_unprofitable: isUnprofitable
      };
    });

    res.json({
      valid: validation.isValid,
      validation_error: validation.error,
      base_retail_price_ngn: baseNgn,
      base_retail_price_usd: baseUsd,
      supplier_cost_ngn: costNgn,
      previews
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Profit protection audit for bulk tiers
adminRouter.get('/bulk-pricing/audit', async (req, res) => {
  try {
    const products = await dbService.query<Product>(`
      SELECT * FROM products WHERE bulk_pricing_enabled = 1 AND bulk_pricing_mode = 'fixed_unit_price'
    `);

    const unprofitableItems = [];

    for (const p of products) {
      const tiers = await dbService.query<BulkPricingTier>(`
        SELECT * FROM product_bulk_pricing_tiers WHERE product_id = ?
      `, [p.id]);

      const failingTiers = tiers.filter(t => t.fixed_unit_price_ngn < p.supplier_cost_ngn);
      if (failingTiers.length > 0) {
        unprofitableItems.push({
          product_id: p.id,
          product_title: p.title,
          supplier_cost_ngn: p.supplier_cost_ngn,
          failing_tiers: failingTiers.map(t => ({
            id: t.id,
            range: `${t.min_quantity}${t.max_quantity ? '-' + t.max_quantity : '+'}`,
            fixed_unit_price_ngn: t.fixed_unit_price_ngn,
            deficit_per_unit_ngn: p.supplier_cost_ngn - t.fixed_unit_price_ngn
          }))
        });
      }
    }

    res.json({
      total_products_checked: products.length,
      unprofitable_count: unprofitableItems.length,
      flagged_products: unprofitableItems
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create manual non-supplier product
adminRouter.post('/products/manual', async (req, res) => {
  try {
    const {
      title,
      description,
      category = 'General',
      access_type = 'digital_access',
      duration = '1_year',
      cost_usd = 0,
      retail_price_ngn
    } = req.body;

    if (!title || !description || retail_price_ngn === undefined) {
      return res.status(400).json({ error: 'Title, description, and retail price are required.' });
    }

    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const exchangeRate = Number(rateSetting?.value || 1450);

    const now = new Date().toISOString();
    const sourceId = `man-${Date.now()}`;
    const id = `prod-manual-${sourceId}`;
    const slug = `${title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}-${sourceId}`;
    const costNgn = roundToMarketNaira(Number(cost_usd) * exchangeRate);

    await dbService.run(`
      INSERT INTO products (
        id, source_type, source_product_id, title, slug, short_description, description,
        category, access_type, duration, supplier_cost_usdt, supplier_base_cost_usdt,
        supplier_cost_ngn, stock_count, is_unlimited, is_supplier_available, reseller_approved,
        is_active, terms_of_service, delivery_instructions, created_at, updated_at
      ) VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 1, 1, 1, 1, ?, ?, ?, ?)
    `, [
      id,
      sourceId,
      title,
      slug,
      description.slice(0, 120),
      description,
      category,
      access_type,
      duration,
      Number(cost_usd),
      Number(cost_usd),
      costNgn,
      'Direct customer license delivery.',
      'License credentials delivered to order dashboard.',
      now,
      now
    ]);

    await dbService.run(`
      INSERT INTO pricing_rules (
        id, product_id, pricing_mode, markup_value, manual_price_ngn, manual_price_usd, allow_negative_margin
      ) VALUES (?, ?, 'manual', 0, ?, ?, 0)
    `, [
      `rule-${id}`,
      id,
      Number(retail_price_ngn),
      Math.round((Number(retail_price_ngn) / exchangeRate) * 100) / 100
    ]);

    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'ADMIN_USER', 'MANUAL_PRODUCT_CREATED', 'product', ?, ?, ?, ?)
    `, [
      `log-${Date.now()}`,
      id,
      `Created manual product "${title}" (ID: ${id}) with retail price ₦${Number(retail_price_ngn).toLocaleString()}`,
      req.ip || '127.0.0.1',
      now
    ]);

    res.json({ success: true, product_id: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Pricing Rule with Negative-Margin Guardrail & Profit Engine
adminRouter.post('/products/:id/pricing', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      pricing_mode = 'percentage_markup',
      calculation_type = 'markup',
      markup_value,
      manual_price_ngn,
      manual_price_usd,
      reference_price_ngn,
      reference_price_usd,
      reference_source_url,
      reference_plan_name,
      reference_verified_at,
      allow_negative_margin = false,
      override_reason,
      is_active = 1,
      min_profit_ngn = 0,
      min_price_ngn = 0,
      price_locked = 0
    } = req.body;

    const product = await dbService.queryOne<Product>(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const exchangeRate = Number(rateSetting?.value || 1450);

    let candidateRetailNgn = product.supplier_cost_ngn;
    if (pricing_mode === 'manual' && manual_price_ngn) {
      candidateRetailNgn = roundToMarketNaira(Number(manual_price_ngn));
    } else if (pricing_mode === 'fixed_markup') {
      let raw = product.supplier_cost_ngn + Number(markup_value || 0);
      if (min_profit_ngn > 0 && (raw - product.supplier_cost_ngn) < min_profit_ngn) {
        raw = product.supplier_cost_ngn + Number(min_profit_ngn);
      }
      candidateRetailNgn = roundToMarketNaira(raw);
    } else if (calculation_type === 'margin' || pricing_mode === 'margin') {
      const safeMargin = Math.min(Math.max(0, Number(markup_value || 0)), 95) / 100;
      let raw = product.supplier_cost_ngn / (1 - safeMargin);
      if (min_profit_ngn > 0 && (raw - product.supplier_cost_ngn) < min_profit_ngn) {
        raw = product.supplier_cost_ngn + Number(min_profit_ngn);
      }
      if (min_price_ngn > 0 && raw < min_price_ngn) {
        raw = Number(min_price_ngn);
      }
      candidateRetailNgn = roundToMarketNaira(raw);
    } else {
      let raw = product.supplier_cost_ngn * (1 + Number(markup_value || 0) / 100);
      if (min_profit_ngn > 0 && (raw - product.supplier_cost_ngn) < min_profit_ngn) {
        raw = product.supplier_cost_ngn + Number(min_profit_ngn);
      }
      if (min_price_ngn > 0 && raw < min_price_ngn) {
        raw = Number(min_price_ngn);
      }
      candidateRetailNgn = roundToMarketNaira(raw);
    }

    const validation = validatePricingUpdate(
      product.supplier_cost_ngn,
      candidateRetailNgn,
      Boolean(allow_negative_margin),
      override_reason
    );

    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    const now = new Date().toISOString();
    const verifiedTimestamp = reference_verified_at || (reference_price_ngn ? now : null);

    await dbService.run(`
      INSERT INTO pricing_rules (
        id, product_id, pricing_mode, calculation_type, markup_value, manual_price_ngn, manual_price_usd,
        reference_price_ngn, reference_price_usd, reference_source_url, reference_plan_name,
        reference_verified_at, reference_verified_by, allow_negative_margin, override_reason,
        is_active, min_profit_ngn, min_price_ngn, price_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        pricing_mode = excluded.pricing_mode,
        calculation_type = excluded.calculation_type,
        markup_value = excluded.markup_value,
        manual_price_ngn = excluded.manual_price_ngn,
        manual_price_usd = excluded.manual_price_usd,
        reference_price_ngn = excluded.reference_price_ngn,
        reference_price_usd = excluded.reference_price_usd,
        reference_source_url = excluded.reference_source_url,
        reference_plan_name = excluded.reference_plan_name,
        reference_verified_at = excluded.reference_verified_at,
        reference_verified_by = excluded.reference_verified_by,
        allow_negative_margin = excluded.allow_negative_margin,
        override_reason = excluded.override_reason,
        is_active = excluded.is_active,
        min_profit_ngn = excluded.min_profit_ngn,
        min_price_ngn = excluded.min_price_ngn,
        price_locked = excluded.price_locked
    `, [
      `rule-${product.id}`,
      product.id,
      pricing_mode,
      calculation_type,
      Number(markup_value || 0),
      manual_price_ngn ? Number(manual_price_ngn) : null,
      manual_price_usd ? Number(manual_price_usd) : null,
      reference_price_ngn ? Number(reference_price_ngn) : null,
      reference_price_usd ? Number(reference_price_usd) : null,
      reference_source_url || null,
      reference_plan_name || null,
      verifiedTimestamp,
      reference_price_ngn ? 'Compliance Lead' : null,
      allow_negative_margin ? 1 : 0,
      override_reason || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      Number(min_profit_ngn || 0),
      Number(min_price_ngn || 0),
      price_locked ? 1 : 0
    ]);

    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'ADMIN_USER', 'PRICING_UPDATED', 'product', ?, ?, ?, ?)
    `, [
      `log-${Date.now()}`,
      product.id,
      `Updated pricing mode: ${pricing_mode} (${calculation_type} ${markup_value}%). Retail: ₦${candidateRetailNgn.toLocaleString()} vs cost ₦${product.supplier_cost_ngn.toLocaleString()}.${allow_negative_margin ? ` Negative margin overridden: ${override_reason}` : ''}`,
      req.ip || '127.0.0.1',
      now
    ]);

    res.json({ success: true, message: 'Pricing rule and profit parameters updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Category Pricing Rules (List, Upsert, Delete)
adminRouter.get('/pricing-rules/category', async (req, res) => {
  try {
    const rules = await dbService.query<CategoryPricingRule>(
      `SELECT * FROM category_pricing_rules ORDER BY category ASC`
    );
    res.json({ rules });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/pricing-rules/category', async (req, res) => {
  try {
    const {
      category,
      calculation_type = 'markup',
      percentage = 20,
      min_profit_ngn = 0,
      is_active = 1
    } = req.body;

    if (!category || String(category).trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const trimmedCategory = String(category).trim();
    const now = new Date().toISOString();
    const ruleId = `catrule-${trimmedCategory.toLowerCase().replace(/[^\w-]/g, '')}`;

    await dbService.run(`
      INSERT INTO category_pricing_rules (
        id, category, calculation_type, percentage, min_profit_ngn, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(category) DO UPDATE SET
        calculation_type = excluded.calculation_type,
        percentage = excluded.percentage,
        min_profit_ngn = excluded.min_profit_ngn,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `, [
      ruleId,
      trimmedCategory,
      calculation_type === 'margin' ? 'margin' : 'markup',
      Number(percentage || 0),
      Number(min_profit_ngn || 0),
      is_active ? 1 : 0,
      now,
      now
    ]);

    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'ADMIN_USER', 'CATEGORY_RULE_UPDATED', 'category', ?, ?, ?, ?)
    `, [
      `log-${Date.now()}`,
      trimmedCategory,
      `Configured ${calculation_type} rule (${percentage}%, min profit: ₦${min_profit_ngn}) for category "${trimmedCategory}"`,
      req.ip || '127.0.0.1',
      now
    ]);

    res.json({ success: true, message: `Category pricing rule saved for "${trimmedCategory}".` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.delete('/pricing-rules/category/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbService.run(`DELETE FROM category_pricing_rules WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Category rule deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Pricing Simulation & Real-time Calculator
adminRouter.post('/pricing-simulation', async (req, res) => {
  try {
    const {
      cost_usdt,
      exchange_rate,
      mode = 'percentage_markup',
      calculation_type = 'markup',
      rate = 20,
      min_profit_ngn = 0,
      min_price_ngn = 0,
      manual_price_ngn
    } = req.body;

    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const effRate = exchange_rate ? Number(exchange_rate) : Number(rateSetting?.value || 1450);

    const result = previewPricingCalculation({
      costUsdt: Number(cost_usdt || 0),
      exchangeRate: effRate,
      mode,
      calculationType: calculation_type,
      rate: Number(rate || 0),
      minProfitNgn: Number(min_profit_ngn || 0),
      minPriceNgn: Number(min_price_ngn || 0),
      manualPriceNgn: manual_price_ngn ? Number(manual_price_ngn) : undefined
    });

    res.json({ simulation: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Discrepancy & Alert Center
adminRouter.get('/alerts', async (req, res) => {
  try {
    const rateSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
    );
    const exchangeRate = Number(rateSetting?.value || 1450);
    const syncErrorSetting = await dbService.queryOne<{ value: string }>(
      `SELECT value FROM admin_settings WHERE key = 'catalogue_last_sync_error'`
    );
    const pricingOptions = await getPricingEngineContext();

    const products = await dbService.query<Product>(`SELECT * FROM products`);
    const rules = await dbService.query<PricingRule>(`SELECT * FROM pricing_rules`);
    const ruleMap = new Map<string, PricingRule>();
    for (const r of rules) {
      ruleMap.set(r.product_id, r);
    }

    const computed = products.map(p => {
      const rule = ruleMap.get(p.id) || null;
      return computeProductPricing(p, rule, exchangeRate, pricingOptions);
    });

    const negativeMargin = computed.filter(p => p.retail_price_ngn < p.supplier_cost_ngn);
    const lowStock = computed.filter(p => p.is_unlimited !== 1 && p.stock_count <= 2);
    const upstreamUnavailable = computed.filter(p => p.is_supplier_available !== 1);
    const pendingApproval = computed.filter(p => p.reseller_approved !== 1);
    const staleBenchmarks = computed.filter(p => p.is_reference_stale && p.pricing?.reference_price_ngn);

    res.json({
      summary: {
        total_alerts: negativeMargin.length + lowStock.length + upstreamUnavailable.length + (syncErrorSetting?.value ? 1 : 0),
        negative_margin_count: negativeMargin.length,
        low_stock_count: lowStock.length,
        upstream_unavailable_count: upstreamUnavailable.length,
        pending_approval_count: pendingApproval.length,
        stale_benchmarks_count: staleBenchmarks.length,
        has_sync_error: Boolean(syncErrorSetting?.value)
      },
      alerts: {
        negative_margin_products: negativeMargin.map(p => ({
          id: p.id,
          title: p.title,
          cost_ngn: p.supplier_cost_ngn,
          retail_price_ngn: p.retail_price_ngn,
          deficit_ngn: p.supplier_cost_ngn - p.retail_price_ngn,
          rule: p.effective_pricing?.rule_name
        })),
        low_stock_products: lowStock.map(p => ({
          id: p.id,
          title: p.title,
          stock_count: p.stock_count,
          is_unlimited: p.is_unlimited === 1
        })),
        upstream_unavailable_products: upstreamUnavailable.map(p => ({
          id: p.id,
          title: p.title,
          source_product_id: p.source_product_id,
          last_synced_at: p.last_synced_at
        })),
        pending_approval_products: pendingApproval.map(p => ({
          id: p.id,
          title: p.title,
          source_product_id: p.source_product_id,
          supplier_cost_usdt: p.supplier_cost_usdt
        })),
        stale_benchmarks_products: staleBenchmarks.map(p => ({
          id: p.id,
          title: p.title,
          reference_source_url: p.pricing?.reference_source_url,
          reference_verified_at: p.pricing?.reference_verified_at
        })),
        last_sync_error: syncErrorSetting?.value || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ingested Supplier Catalogue (Raw wholesale records and provenance audit)
adminRouter.get('/supplier/catalogue', async (req, res) => {
  try {
    const products = await dbService.query<Product>(`
      SELECT id, source_type, source_product_id, title, category,
             supplier_cost_usdt, supplier_base_cost_usdt, supplier_cost_ngn,
             stock_count, is_unlimited, is_supplier_available, reseller_approved, is_active,
             raw_supplier_payload, last_synced_at, created_at
      FROM products
      WHERE source_type = 'insightxpro'
      ORDER BY last_synced_at DESC
    `);

    res.json({
      total: products.length,
      supplier: 'InsightXPro Reseller API',
      api_endpoint: 'https://api.insightxpro.store/api/v1/products',
      records: products.map(p => {
        let parsed = null;
        try {
          if (p.raw_supplier_payload) parsed = JSON.parse(p.raw_supplier_payload);
        } catch {}
        return {
          ...p,
          parsed_payload: parsed
        };
      })
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Supplier Catalogue Synchronization
adminRouter.post('/supplier/sync', async (req, res) => {
  try {
    if (!insightXProClient.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'InsightXPro API key is not configured. Set INSIGHT_API_KEY in server environment variables to synchronize live products.',
        message: 'InsightXPro API key is not configured. Set INSIGHT_API_KEY in server environment variables to synchronize live products.'
      });
    }

    const result = await syncSupplierCatalogue(insightXProClient);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        message: `Catalogue synchronization failed: ${result.error}`
      });
    }

    res.json({
      success: true,
      message: `Successfully synchronized ${result.total_received} live products from InsightXPro (${result.new_items_added} added, ${result.existing_items_updated} updated, ${result.absent_items_disabled} disabled).`,
      result
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check Supplier Balance and API Connectivity
adminRouter.get('/supplier/balance', async (req, res) => {
  try {
    const balance = await insightXProClient.getBalance();
    res.json({
      ...balance,
      balance_usd: balance.balance_usdt,
      is_configured: insightXProClient.isConfigured(),
      masked_api_key: insightXProClient.getMaskedKey(),
      base_url: insightXProClient.getBaseUrl()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List All Suppliers & Integration Status
adminRouter.get('/suppliers', async (req, res) => {
  try {
    const lastSyncSetting = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'catalogue_last_synced'`);
    const lastSyncErrorSetting = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'catalogue_last_sync_error'`);
    const syncIntervalSetting = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'catalogue_sync_interval_minutes'`);
    const lastTestSetting = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'insightxpro_last_connection_test'`);
    const totalSupplierProducts = await dbService.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM products WHERE source_type = 'insightxpro'`);
    const availableSupplierProducts = await dbService.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM products WHERE source_type = 'insightxpro' AND is_supplier_available = 1`);

    const suppliers = [
      {
        id: 'insightxpro',
        name: 'InsightXPro Reseller API',
        api_base_url: insightXProClient.getBaseUrl(),
        auth_type: 'X-API-Key',
        adapter_name: 'insightxpro',
        adapter_status: 'native_active',
        is_configured: insightXProClient.isConfigured(),
        masked_api_key: insightXProClient.getMaskedKey(),
        is_enabled: true,
        sync_schedule: `Every ${syncIntervalSetting?.value || '60'} minutes`,
        sync_interval_minutes: Number(syncIntervalSetting?.value || 60),
        last_synced_at: lastSyncSetting?.value || null,
        last_sync_error: lastSyncErrorSetting?.value || null,
        last_connection_test: lastTestSetting?.value ? JSON.parse(lastTestSetting.value) : null,
        total_products: totalSupplierProducts?.count || 0,
        available_products: availableSupplierProducts?.count || 0,
        documentation_url: 'https://api.insightxpro.store/docs',
        catalogue_endpoint: 'GET https://api.insightxpro.store/api/v1/products',
        stock_model: 'Direct live wholesale inventory with optional unlimited license flag'
      },
      {
        id: 'secondary_custom_api',
        name: 'Secondary Reseller API (Multi-Source Hub)',
        api_base_url: 'https://api.custom-supplier.example/v1',
        auth_type: 'Bearer / HMAC',
        adapter_name: 'custom_adapter',
        adapter_status: 'adapter_required',
        is_configured: false,
        masked_api_key: null,
        is_enabled: false,
        sync_schedule: 'Manual / On-demand',
        sync_interval_minutes: 120,
        last_synced_at: null,
        last_sync_error: null,
        last_connection_test: null,
        total_products: 0,
        available_products: 0,
        documentation_url: 'https://toolpadi.internal/docs/supplier-adapters',
        catalogue_endpoint: 'Custom Endpoint',
        stock_model: 'Pending custom adapter implementation'
      }
    ];

    res.json({ suppliers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Supplier Credentials and Configuration
adminRouter.post('/suppliers/:id/credentials', async (req, res) => {
  try {
    const { id } = req.params;
    const { api_key, api_base_url, sync_interval_minutes } = req.body;

    if (id !== 'insightxpro') {
      return res.status(400).json({
        error: `Supplier '${id}' requires a dedicated TypeScript adapter before activation. Only 'insightxpro' is currently active.`
      });
    }

    const now = new Date().toISOString();

    if (api_key !== undefined) {
      const cleanKey = api_key.trim();
      if (cleanKey.length > 0) {
        await dbService.run(
          `INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ('insightxpro_api_key', ?, ?)`,
          [cleanKey, now]
        );
        insightXProClient.setCredentials(cleanKey);
      } else {
        await dbService.run(`DELETE FROM admin_settings WHERE key = 'insightxpro_api_key'`);
        insightXProClient.setCredentials(null);
      }
    }

    if (api_base_url !== undefined && api_base_url.trim().length > 0) {
      const cleanUrl = api_base_url.trim();
      await dbService.run(
        `INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ('insightxpro_base_url', ?, ?)`,
        [cleanUrl, now]
      );
      insightXProClient.setCredentials(insightXProClient.getApiKey(), cleanUrl);
    }

    if (sync_interval_minutes !== undefined) {
      await dbService.run(
        `INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ('catalogue_sync_interval_minutes', ?, ?)`,
        [String(sync_interval_minutes), now]
      );
    }

    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'ADMIN_USER', 'SUPPLIER_CREDENTIALS_UPDATED', 'supplier', ?, ?, ?, ?)
    `, [
      `log-${Date.now()}`,
      id,
      `Updated credentials and configuration for supplier ${id}. Key configured: ${insightXProClient.isConfigured()}`,
      req.ip || '127.0.0.1',
      now
    ]);

    res.json({
      success: true,
      message: `Supplier '${id}' configuration and credentials updated successfully.`,
      is_configured: insightXProClient.isConfigured(),
      masked_api_key: insightXProClient.getMaskedKey(),
      base_url: insightXProClient.getBaseUrl()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test Live Connection to Supplier API
adminRouter.post('/suppliers/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { candidate_api_key, candidate_base_url } = req.body;

    if (id !== 'insightxpro') {
      return res.status(400).json({
        success: false,
        error: `Supplier '${id}' does not have an active integration adapter to test.`
      });
    }

    const testResult = await insightXProClient.testConnection(candidate_api_key, candidate_base_url);

    // Save test result in settings for historical display
    const now = new Date().toISOString();
    await dbService.run(
      `INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ('insightxpro_last_connection_test', ?, ?)`,
      [JSON.stringify({ ...testResult, tested_at: now }), now]
    );

    res.json(testResult);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Customers Management Endpoint
adminRouter.get('/customers', async (req, res) => {
  try {
    const customers = await dbService.query(`
      SELECT 
        c.*,
        COUNT(o.id) as order_count,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) as total_spent_ngn,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json({ customers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Payment Reconciliation & Audit Endpoint
adminRouter.get('/payments/reconciliation', async (req, res) => {
  try {
    const transactions = await dbService.query(`
      SELECT 
        pt.*,
        o.order_reference,
        o.customer_name,
        o.customer_email,
        o.total_amount as order_amount,
        o.payment_status as order_payment_status
      FROM payment_transactions pt
      LEFT JOIN orders o ON o.id = pt.order_id
      ORDER BY pt.created_at DESC
      LIMIT 100
    `);

    const summary = await dbService.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM payment_transactions
      GROUP BY status
    `);

    res.json({ transactions, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sales & Profit Reporting Analytics Endpoint
adminRouter.get('/reports/sales', async (req, res) => {
  try {
    const paidOrders = await dbService.query<Order>(`
      SELECT * FROM orders WHERE payment_status = 'paid' ORDER BY created_at DESC
    `);

    const totalRevenueNgn = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Calculate wholesale cost
    const items = await dbService.query(`
      SELECT oi.* FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status = 'paid'
    `);

    const totalWholesaleCostNgn = items.reduce((sum: number, it: any) => sum + ((it.supplier_cost || 0) * (it.quantity || 1)), 0);
    const estimatedNetProfitNgn = Math.max(0, totalRevenueNgn - totalWholesaleCostNgn);
    const marginPercentage = totalRevenueNgn > 0 ? ((estimatedNetProfitNgn / totalRevenueNgn) * 100) : 0;

    res.json({
      total_paid_orders: paidOrders.length,
      total_revenue_ngn: totalRevenueNgn,
      total_wholesale_cost_ngn: totalWholesaleCostNgn,
      estimated_net_profit_ngn: estimatedNetProfitNgn,
      effective_margin_percentage: Number(marginPercentage.toFixed(1)),
      items_fulfilled: items.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Data Export Tools (JSON / CSV)
adminRouter.get('/export/:entity', async (req, res) => {
  try {
    const { entity } = req.params;
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    let data: any[] = [];
    if (entity === 'products') {
      data = await dbService.query(`SELECT * FROM products ORDER BY created_at DESC`);
    } else if (entity === 'orders') {
      data = await dbService.query(`SELECT * FROM orders ORDER BY created_at DESC`);
    } else if (entity === 'customers') {
      data = await dbService.query(`SELECT * FROM customers ORDER BY created_at DESC`);
    } else if (entity === 'audit_logs') {
      data = await dbService.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500`);
    } else {
      return res.status(400).json({ error: `Invalid export entity '${entity}'. Supported: products, orders, customers, audit_logs` });
    }

    if (format === 'csv') {
      if (data.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="toolpadi_${entity}.csv"`);
        return res.send('');
      }
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(h => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]).replace(/"/g, '""');
          return `"${val}"`;
        }).join(','))
      ];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="toolpadi_${entity}.csv"`);
      return res.send(csvRows.join('\n'));
    }

    res.setHeader('Content-Disposition', `attachment; filename="toolpadi_${entity}.json"`);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List All Orders
adminRouter.get('/orders', async (req, res) => {
  try {
    const orders = await dbService.query<Order>(`
      SELECT * FROM orders ORDER BY created_at DESC
    `);

    const orderListWithDetails = [];
    for (const o of orders) {
      const items = await dbService.query(`SELECT * FROM order_items WHERE order_id = ?`, [o.id]);
      const deliveries = await dbService.query(`SELECT * FROM deliveries WHERE order_id = ?`, [o.id]);
      orderListWithDetails.push({ ...o, items, deliveries });
    }

    res.json({ orders: orderListWithDetails });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Process Order Refund
adminRouter.post('/orders/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Refund requested within warranty' } = req.body;

    const order = await dbService.queryOne<Order>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const now = new Date().toISOString();
    await dbService.run(`UPDATE orders SET payment_status = 'refunded', notes = ?, updated_at = ? WHERE id = ?`, [
      `Refunded: ${reason}`, now, id
    ]);
    await dbService.run(`UPDATE deliveries SET delivery_status = 'revoked' WHERE order_id = ?`, [id]);
    await dbService.run(`UPDATE payment_transactions SET status = 'refunded' WHERE order_id = ?`, [id]);

    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'ADMIN_USER', 'ORDER_REFUNDED', 'order', ?, ?, ?, ?)
    `, [
      `log-${Date.now()}`,
      id,
      `Refund processed for ${order.order_reference}. Reason: ${reason}. License revoked.`,
      req.ip || '127.0.0.1',
      now
    ]);

    res.json({ success: true, message: `Order ${order.order_reference} marked as refunded.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs stream
adminRouter.get('/audit-logs', async (req, res) => {
  try {
    const logs = await dbService.query<AuditLog>(`
      SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100
    `);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Settings
adminRouter.get('/settings', async (req, res) => {
  try {
    const settings = await dbService.query<AdminSetting>(`SELECT * FROM admin_settings`);
    const settingMap: Record<string, string> = {};
    for (const s of settings) {
      settingMap[s.key] = s.value;
    }
    res.json({ settings: settingMap });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/settings', async (req, res) => {
  try {
    const {
      usd_ngn_rate,
      payment_mode,
      default_percentage_markup,
      global_markup_percentage,
      global_calculation_type,
      global_min_profit_ngn,
      global_min_price_ngn,
      rounding_rule,
      min_margin_protection_enabled,
      catalogue_sync_interval_minutes
    } = req.body;
    const now = new Date().toISOString();

    const updates: Record<string, any> = {
      ...(usd_ngn_rate !== undefined && { usd_ngn_rate: String(usd_ngn_rate) }),
      ...(payment_mode !== undefined && { payment_mode: String(payment_mode) }),
      ...(default_percentage_markup !== undefined && {
        default_percentage_markup: String(default_percentage_markup),
        global_markup_percentage: String(default_percentage_markup)
      }),
      ...(global_markup_percentage !== undefined && { global_markup_percentage: String(global_markup_percentage) }),
      ...(global_calculation_type !== undefined && { global_calculation_type: String(global_calculation_type) }),
      ...(global_min_profit_ngn !== undefined && { global_min_profit_ngn: String(global_min_profit_ngn) }),
      ...(global_min_price_ngn !== undefined && { global_min_price_ngn: String(global_min_price_ngn) }),
      ...(rounding_rule !== undefined && { rounding_rule: String(rounding_rule) }),
      ...(min_margin_protection_enabled !== undefined && { min_margin_protection_enabled: String(min_margin_protection_enabled) }),
      ...(catalogue_sync_interval_minutes !== undefined && { catalogue_sync_interval_minutes: String(catalogue_sync_interval_minutes) })
    };

    for (const [key, val] of Object.entries(updates)) {
      await dbService.run(
        `INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, ?)`,
        [key, val, now]
      );
    }

    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'ADMIN_USER', 'PLATFORM_SETTINGS_UPDATED', 'settings', 'global', ?, ?, ?)
    `, [
      `log-${Date.now()}`,
      `Updated platform settings: ${Object.keys(updates).join(', ')}`,
      req.ip || '127.0.0.1',
      now
    ]);

    res.json({ success: true, message: 'Platform and profit engine settings updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// BULK PRICING OVERVIEW & DIRECTORY ENDPOINT
// =========================================================================
adminRouter.get('/bulk-pricing/summary', async (req, res) => {
  try {
    const rateSetting = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`);
    const exchangeRate = Number(rateSetting?.value || 1450);

    const allProducts = await dbService.query<Product>(`
      SELECT * FROM products ORDER BY reseller_approved DESC, is_active DESC, title ASC
    `);

    const allTiers = await dbService.query<BulkPricingTier>(`
      SELECT * FROM product_bulk_pricing_tiers ORDER BY product_id, min_quantity ASC
    `);

    const tiersByProductId = new Map<string, BulkPricingTier[]>();
    for (const t of allTiers) {
      const arr = tiersByProductId.get(t.product_id) || [];
      arr.push(t);
      tiersByProductId.set(t.product_id, arr);
    }

    const rules = await dbService.query<PricingRule>(`SELECT * FROM pricing_rules`);
    const ruleMap = new Map<string, PricingRule>();
    for (const r of rules) ruleMap.set(r.product_id, r);
    const pricingOptions = await getPricingEngineContext();

    const bulkProducts = allProducts.map(p => {
      const pTiers = tiersByProductId.get(p.id) || [];
      const rule = ruleMap.get(p.id) || null;
      const computed = computeProductPricing(p, rule, exchangeRate, pricingOptions);
      return {
        id: p.id,
        source_product_id: p.source_product_id,
        title: p.title,
        category: p.category,
        supplier_cost_ngn: p.supplier_cost_ngn,
        retail_price_ngn: computed.retail_price_ngn,
        retail_price_usd: computed.retail_price_usd,
        reseller_approved: p.reseller_approved,
        is_active: p.is_active,
        purchasable_override: p.purchasable_override,
        stock_count: p.stock_count,
        is_unlimited: p.is_unlimited,
        bulk_pricing_enabled: p.bulk_pricing_enabled === 1,
        bulk_pricing_mode: p.bulk_pricing_mode || 'discount_percent',
        max_order_quantity: p.max_order_quantity || 0,
        tiers_count: pTiers.length,
        tiers: pTiers
      };
    });

    const activeBulkProducts = bulkProducts.filter(p => p.bulk_pricing_enabled && p.tiers_count > 0);
    const totalTiersCount = allTiers.length;
    const discountModeCount = activeBulkProducts.filter(p => p.bulk_pricing_mode === 'discount_percent').length;
    const fixedModeCount = activeBulkProducts.filter(p => p.bulk_pricing_mode === 'fixed_unit_price').length;

    res.json({
      summary: {
        total_products: allProducts.length,
        bulk_enabled_count: activeBulkProducts.length,
        total_tiers_configured: totalTiersCount,
        discount_mode_count: discountModeCount,
        fixed_mode_count: fixedModeCount,
        exchange_rate: exchangeRate
      },
      products: bulkProducts
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// QUALITY ASSURANCE & VERIFICATION TEST SUITE RUNNER
// =========================================================================
adminRouter.all('/testing/run', async (req, res) => {
  try {
    const report = await runAllVerificationTests();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/testing/scenario/:scenarioId', async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const result = await executeScenarioTest(scenarioId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Seeds realistic bulk pricing on multiple catalogue items for preview demonstration
adminRouter.post('/testing/seed-bulk-showcase', async (req, res) => {
  try {
    const now = new Date().toISOString();

    // 1. Framer Pro 1 Year (prod-insightxpro-4): Fixed unit price mode
    await dbService.run(`
      UPDATE products
      SET reseller_approved = 1, is_active = 1, purchasable_override = 1,
          bulk_pricing_enabled = 1, bulk_pricing_mode = 'fixed_unit_price',
          max_order_quantity = 25, updated_at = ?
      WHERE id = 'prod-insightxpro-4'
    `, [now]);

    await dbService.run(`DELETE FROM product_bulk_pricing_tiers WHERE product_id = 'prod-insightxpro-4'`);
    await dbService.run(`
      INSERT INTO product_bulk_pricing_tiers (id, product_id, tier_order, min_quantity, max_quantity, discount_percentage, fixed_unit_price_ngn, fixed_unit_price_usd, created_at, updated_at)
      VALUES
        ('bpt-framer-1', 'prod-insightxpro-4', 1, 5, 19, 0, 69000, 47.59, ?, ?),
        ('bpt-framer-2', 'prod-insightxpro-4', 2, 20, 25, 0, 65500, 45.17, ?, ?)
    `, [now, now, now, now]);

    // 2. Resend Pro 1 Year (prod-insightxpro-65): Automatic discount mode
    await dbService.run(`
      UPDATE products
      SET reseller_approved = 1, is_active = 1, purchasable_override = 1,
          bulk_pricing_enabled = 1, bulk_pricing_mode = 'discount_percent',
          max_order_quantity = 200, updated_at = ?
      WHERE id = 'prod-insightxpro-65'
    `, [now]);

    await dbService.run(`DELETE FROM product_bulk_pricing_tiers WHERE product_id = 'prod-insightxpro-65'`);
    await dbService.run(`
      INSERT INTO product_bulk_pricing_tiers (id, product_id, tier_order, min_quantity, max_quantity, discount_percentage, fixed_unit_price_ngn, fixed_unit_price_usd, created_at, updated_at)
      VALUES
        ('bpt-resend-1', 'prod-insightxpro-65', 1, 5, 19, 12, 0, 0, ?, ?),
        ('bpt-resend-2', 'prod-insightxpro-65', 2, 20, 49, 22, 0, 0, ?, ?),
        ('bpt-resend-3', 'prod-insightxpro-65', 3, 50, null, 35, 0, 0, ?, ?)
    `, [now, now, now, now, now, now]);

    // 3. Super Duolingo 1 Year (prod-insightxpro-75): Automatic discount mode
    await dbService.run(`
      UPDATE products
      SET reseller_approved = 1, is_active = 1, purchasable_override = 1,
          bulk_pricing_enabled = 1, bulk_pricing_mode = 'discount_percent',
          max_order_quantity = 50, updated_at = ?
      WHERE id = 'prod-insightxpro-75'
    `, [now]);

    await dbService.run(`DELETE FROM product_bulk_pricing_tiers WHERE product_id = 'prod-insightxpro-75'`);
    await dbService.run(`
      INSERT INTO product_bulk_pricing_tiers (id, product_id, tier_order, min_quantity, max_quantity, discount_percentage, fixed_unit_price_ngn, fixed_unit_price_usd, created_at, updated_at)
      VALUES
        ('bpt-duo-1', 'prod-insightxpro-75', 1, 5, 14, 10, 0, 0, ?, ?),
        ('bpt-duo-2', 'prod-insightxpro-75', 2, 15, 29, 20, 0, 0, ?, ?),
        ('bpt-duo-3', 'prod-insightxpro-75', 3, 30, null, 30, 0, 0, ?, ?)
    `, [now, now, now, now, now, now]);

    // 4. Gemini Pro 18 Months (prod-insightxpro-14): 4 tiers
    await dbService.run(`
      UPDATE products
      SET reseller_approved = 1, is_active = 1, purchasable_override = 1,
          bulk_pricing_enabled = 1, bulk_pricing_mode = 'discount_percent',
          max_order_quantity = 100, updated_at = ?
      WHERE id = 'prod-insightxpro-14'
    `, [now]);

    await dbService.run(`DELETE FROM product_bulk_pricing_tiers WHERE product_id = 'prod-insightxpro-14'`);
    await dbService.run(`
      INSERT INTO product_bulk_pricing_tiers (id, product_id, tier_order, min_quantity, max_quantity, discount_percentage, fixed_unit_price_ngn, fixed_unit_price_usd, created_at, updated_at)
      VALUES
        ('bpt-gemini-1', 'prod-insightxpro-14', 1, 5, 19, 10, 0, 0, ?, ?),
        ('bpt-gemini-2', 'prod-insightxpro-14', 2, 20, 49, 20, 0, 0, ?, ?),
        ('bpt-gemini-3', 'prod-insightxpro-14', 3, 50, null, 30, 0, 0, ?, ?)
    `, [now, now, now, now, now, now]);

    // 5. Linear Business 1 Year (prod-insightxpro-50): Fixed unit price mode
    await dbService.run(`
      UPDATE products
      SET reseller_approved = 1, is_active = 1, purchasable_override = 1,
          bulk_pricing_enabled = 1, bulk_pricing_mode = 'fixed_unit_price',
          max_order_quantity = 50, updated_at = ?
      WHERE id = 'prod-insightxpro-50'
    `, [now]);

    await dbService.run(`DELETE FROM product_bulk_pricing_tiers WHERE product_id = 'prod-insightxpro-50'`);
    await dbService.run(`
      INSERT INTO product_bulk_pricing_tiers (id, product_id, tier_order, min_quantity, max_quantity, discount_percentage, fixed_unit_price_ngn, fixed_unit_price_usd, created_at, updated_at)
      VALUES
        ('bpt-linear-1', 'prod-insightxpro-50', 1, 5, 19, 0, 36000, 24.83, ?, ?),
        ('bpt-linear-2', 'prod-insightxpro-50', 2, 20, null, 0, 32000, 22.07, ?, ?)
    `, [now, now, now, now]);

    // 6. Notion Business 1 Year (prod-insightxpro-13) & Capcut Pro (prod-insightxpro-31): Approve and make active
    await dbService.run(`
      UPDATE products
      SET reseller_approved = 1, is_active = 1, purchasable_override = 1, updated_at = ?
      WHERE id IN ('prod-insightxpro-13', 'prod-insightxpro-31')
    `, [now]);

    res.json({
      success: true,
      message: 'Showcase bulk pricing tiers seeded and products activated for live preview demonstration.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

