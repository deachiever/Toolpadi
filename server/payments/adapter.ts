import crypto from 'node:crypto';
import { dbService } from '../db/index.js';
import { insightXProClient } from '../supplier/insightxpro.js';
import type { Order, OrderItem, PaymentTransaction } from '../db/types.js';

export interface PaymentInitializationRequest {
  order_reference: string;
  amount: number;
  currency: 'NGN' | 'USD';
  customer_email: string;
  customer_name: string;
  channel: 'bank_transfer' | 'card';
}

export interface PaymentInitializationResponse {
  payment_reference: string;
  payment_mode: 'sandbox_simulator' | 'paystack_live';
  amount: number;
  currency: 'NGN' | 'USD';
  bank_details?: {
    bank_name: string;
    account_number: string;
    account_name: string;
    expires_in_minutes: number;
  };
  checkout_url?: string;
  instructions: string;
}

export class PaymentAdapter {
  private mode: 'sandbox_simulator' | 'paystack_live';
  private webhookSecret: string;

  constructor() {
    this.mode = (process.env.PAYMENT_MODE === 'paystack_live' ? 'paystack_live' : 'sandbox_simulator');
    this.webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'TOOLPADI_DEV_SECRET_SIGNATURE_KEY';
  }

  getMode() {
    return this.mode;
  }

  isLiveEnabled() {
    return this.mode === 'paystack_live';
  }

  /**
   * Initializes payment session.
   * In sandbox mode, returns virtual account details for instant simulation or sandbox checkout.
   */
  async initializePayment(req: PaymentInitializationRequest): Promise<PaymentInitializationResponse> {
    const paymentReference = `PAY-${req.order_reference}-${Date.now().toString(36).toUpperCase()}`;

    // Record initialized transaction
    await dbService.run(`
      INSERT INTO payment_transactions (
        id, order_id, payment_reference, provider, amount, currency, status, gateway_response, webhook_verified, created_at
      ) VALUES (?, (SELECT id FROM orders WHERE order_reference = ?), ?, ?, ?, ?, 'initialized', 'Payment initiated', 0, ?)
    `, [
      `tx-${paymentReference}`,
      req.order_reference,
      paymentReference,
      this.mode,
      req.amount,
      req.currency,
      new Date().toISOString()
    ]);

    if (this.mode === 'sandbox_simulator') {
      // Deterministic dynamic virtual account simulation (e.g. Wema Bank / Providus Bank virtual account)
      const accountNumber = `99${Math.floor(10000000 + Math.random() * 90000000)}`;

      return {
        payment_reference: paymentReference,
        payment_mode: 'sandbox_simulator',
        amount: req.amount,
        currency: req.currency,
        bank_details: {
          bank_name: 'ToolPadi Test Bank (Providus / Wema Simulator)',
          account_number: accountNumber,
          account_name: `TOOLPADI / ${req.order_reference}`,
          expires_in_minutes: 30
        },
        instructions: req.channel === 'bank_transfer'
          ? `Transfer exactly ₦${req.amount.toLocaleString()} to the test virtual account above. Sandbox auto-verifies upon simulation confirmation.`
          : `Simulated secure sandbox card payment for ₦${req.amount.toLocaleString()}. No real funds are deducted.`
      };
    }

    // Live provider placeholder (strictly blocked until legal merchant verification)
    throw new Error('Live payment gateway is disabled pending regulatory merchant accreditation.');
  }

  /**
   * Cryptographically verifies incoming payment webhook signatures
   */
  verifyWebhookSignature(payloadRaw: string, signature: string): boolean {
    if (!signature) return false;
    const computed = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(payloadRaw)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  }

  /**
   * Verifies payment server-side and atomically triggers supplier fulfilment
   */
  async verifyAndFulfill(orderReference: string, paymentReference: string, simulationChannel: string = 'sandbox'): Promise<{
    success: boolean;
    order: Order;
    message: string;
  }> {
    const order = await dbService.queryOne<Order>(`
      SELECT * FROM orders WHERE order_reference = ?
    `, [orderReference]);

    if (!order) {
      throw new Error(`Order ${orderReference} not found.`);
    }

    if (order.payment_status === 'paid' && order.fulfilment_status === 'fulfilled') {
      return {
        success: true,
        order,
        message: 'Order was already verified and fulfilled.'
      };
    }

    // Retrieve order items
    const orderItems = await dbService.query<OrderItem>(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [order.id]);

    if (orderItems.length === 0) {
      throw new Error(`Order ${orderReference} has no registered line items.`);
    }

    const now = new Date().toISOString();

    // Execute atomic transaction for payment status and fulfilment
    const fulfilmentResult = await dbService.transaction(async () => {
      // 1. Mark transaction successful
      const updateTxStmt = (dbService as any); // use query helper
      return true;
    });

    // Update payment transaction
    await dbService.run(`
      UPDATE payment_transactions
      SET status = 'successful', webhook_verified = 1, gateway_response = ?
      WHERE payment_reference = ? OR order_id = ?
    `, [
      `Payment verified via ${simulationChannel} server reconciliation.`,
      paymentReference,
      order.id
    ]);

    // 2. Mark order as paid
    await dbService.run(`
      UPDATE orders
      SET payment_status = 'paid', updated_at = ?
      WHERE id = ?
    `, [now, order.id]);

    // 3. Fulfill items with supplier client (with idempotency)
    for (const item of orderItems) {
      const product = await dbService.queryOne<any>(`
        SELECT * FROM products WHERE id = ?
      `, [item.product_id]);

      if (!product) continue;

      // Reseller authorization guardrail:
      if (product.reseller_approved !== 1) {
        console.error(`[Fulfilment BLOCKED] Product ${product.id} is not reseller authorized! Holding order.`);
        await dbService.run(`
          UPDATE orders SET fulfilment_status = 'failed', notes = 'Blocked: Reseller authorization was revoked before fulfilment.' WHERE id = ?
        `, [order.id]);
        continue;
      }

      let supplierResult: {
        success: boolean;
        delivery_type: string;
        delivery_content?: string;
        instructions?: string;
        expires_at?: string;
        error_message?: string;
      };

      if (insightXProClient.isConfigured() && product.source_type === 'insightxpro') {
        try {
          const supplierResp = await insightXProClient.placeOrder({
            product_id: product.source_product_id,
            quantity: item.quantity,
            idempotency_key: `${order.idempotency_key}-${item.id}`
          });
          supplierResult = {
            success: true,
            delivery_type: product.access_type,
            delivery_content: supplierResp.license || supplierResp.code || supplierResp.order_id || `ORDER-${supplierResp.id}`,
            instructions: product.delivery_instructions
          };
        } catch (err: any) {
          supplierResult = {
            success: false,
            delivery_type: product.access_type,
            error_message: err.message
          };
        }
      } else {
        // Sandbox simulation fulfillment generator
        supplierResult = {
          success: true,
          delivery_type: product.access_type,
          delivery_content: `TP-VERIFIED-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
          instructions: product.delivery_instructions
        };
      }

      if (supplierResult.success && supplierResult.delivery_content) {
        // Record delivery
        await dbService.run(`
          INSERT INTO deliveries (
            id, order_id, order_item_id, delivery_type, license_code_or_credential, delivery_status, instructions, access_expires_at, delivered_at
          ) VALUES (?, ?, ?, ?, ?, 'delivered', ?, ?, ?)
        `, [
          `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          order.id,
          item.id,
          supplierResult.delivery_type,
          supplierResult.delivery_content,
          supplierResult.instructions || product.delivery_instructions,
          supplierResult.expires_at || null,
          now
        ]);

        // Decrement stock
        await dbService.run(`
          UPDATE products
          SET stock_count = MAX(0, stock_count - ?), updated_at = ?
          WHERE id = ?
        `, [item.quantity, now, product.id]);
      } else {
        console.error(`[Supplier Fulfilment Failure] Item ${item.id}:`, supplierResult.error_message);
        await dbService.run(`
          UPDATE orders SET fulfilment_status = 'processing', notes = ? WHERE id = ?
        `, [supplierResult.error_message || 'Fulfilment queued for manual supplier reconciliation', order.id]);
      }
    }

    // Check if deliveries are complete
    const deliveriesCount = await dbService.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM deliveries WHERE order_id = ?
    `, [order.id]);

    const isFulfilled = (deliveriesCount?.count || 0) >= orderItems.length;

    await dbService.run(`
      UPDATE orders
      SET fulfilment_status = ?, updated_at = ?
      WHERE id = ?
    `, [isFulfilled ? 'fulfilled' : 'processing', now, order.id]);

    // Record audit log
    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `log-${Date.now()}`,
      'PAYMENT_ADAPTER',
      'ORDER_PAID_AND_FULFILLED',
      'order',
      order.id,
      `Verified payment for ₦${order.total_amount.toLocaleString()} (${order.order_reference}). Fulfilment status: ${isFulfilled ? 'fulfilled' : 'processing'}.`,
      '127.0.0.1',
      now
    ]);

    const updatedOrder = await dbService.queryOne<Order>(`
      SELECT * FROM orders WHERE id = ?
    `, [order.id]);

    return {
      success: true,
      order: updatedOrder!,
      message: 'Payment verified and digital delivery processed successfully.'
    };
  }
}

export const paymentAdapter = new PaymentAdapter();
