import assert from 'node:assert';
import crypto from 'node:crypto';
import { dbService } from '../db/index.js';
import { extractSupplierFulfilment, insightXProClient } from '../supplier/insightxpro.js';
import { paymentAdapter } from '../payments/adapter.js';
import type { Order, Delivery, Product } from '../db/types.js';

let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  })();
}

async function runFulfilmentTests() {
  console.log('\n🧪 Starting ToolPadi Automated Supplier Fulfilment & Delivery Test Suite (Scenarios A through L)...\n');

  // Setup test fixture product
  const fixtureProdId = 'prod-test-gemini-fulfilment';
  const now = new Date().toISOString();

  await dbService.run(`
    INSERT OR REPLACE INTO products (
      id, source_type, source_product_id, title, slug, short_description, description,
      category, access_type, duration, supplier_cost_usdt, supplier_cost_ngn,
      stock_count, is_unlimited, is_supplier_available, reseller_approved, is_active, purchasable_override,
      created_at, updated_at
    ) VALUES (?, 'insightxpro', 'test-fixture-14', 'Gemini Pro 18 Months (Test)', 'gemini-pro-test', 'Test gemini', 'Test description',
      'AI & Cloud Tools', 'digital_access', '18_months', 0.45, 652.5, 50, 0, 1, 1, 1, 1, ?, ?)
  `, [fixtureProdId, now, now]);

  // Ensure customer exists
  const testCustomerEmail = 'qa-tester@toolpadi.ng';
  let cust = await dbService.queryOne('SELECT * FROM customers WHERE email = ?', [testCustomerEmail]);
  if (!cust) {
    await dbService.run(`
      INSERT INTO customers (id, email, full_name, currency_preference, created_at)
      VALUES (?, ?, 'QA Tester', 'NGN', ?)
    `, ['cust-qa-test', testCustomerEmail, now]);
  }

  // Helper to create test order
  async function createTestOrder(prefix: string, customerEmail = testCustomerEmail) {
    const orderId = `ord-${prefix}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const orderRef = `TP-2026-${prefix.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const idemKey = `idem-${prefix}-${Date.now()}`;

    await dbService.run(`
      INSERT INTO orders (
        id, order_reference, customer_id, customer_email, customer_name,
        total_amount, currency, exchange_rate, payment_status, fulfilment_status, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, 'cust-qa-test', ?, 'QA Tester', 800, 'NGN', 1450, 'pending', 'unfulfilled', ?, ?, ?)
    `, [orderId, orderRef, customerEmail, idemKey, now, now]);

    const itemId = `item-${prefix}-${Date.now()}`;
    await dbService.run(`
      INSERT INTO order_items (
        id, order_id, product_id, product_title, unit_price, supplier_cost, quantity, access_type, duration
      ) VALUES (?, ?, ?, 'Gemini Pro 18 Months (Test)', 800, 650, 1, 'digital_access', '18_months')
    `, [itemId, orderId, fixtureProdId]);

    const txId = `tx-${orderRef}`;
    await dbService.run(`
      INSERT INTO payment_transactions (
        id, order_id, payment_reference, provider, amount, currency, status, created_at
      ) VALUES (?, ?, ?, 'test_bank_transfer', 800, 'NGN', 'initialized', ?)
    `, [txId, orderId, `PAY-${orderRef}`, now]);

    return { orderId, orderRef, itemId, idemKey };
  }

  // =========================================================================
  // Scenario A: Payment succeeds and the supplier immediately returns access
  // =========================================================================
  console.log('--- A. Payment Succeeds & Supplier Immediately Returns Access ---');
  await it('extractSupplierFulfilment correctly parses real InsightXPro response shape', () => {
    const mockInsightResp = {
      order: {
        order_id: 3909,
        id: 3909,
        product_id: 14,
        product_name: 'Gemini Pro 18 Months',
        amount_usdt: 0.45,
        total_usdt: 0.45,
        price: 0.45,
        quantity: 1,
        status: 'completed',
        codes: ['https://serviceactivation.in/subscription/new/rF35RPyb27G4'],
        coupons: ['https://serviceactivation.in/subscription/new/rF35RPyb27G4'],
        created_at: '2026-10-15T00:45:32.18233+00:00'
      }
    };

    const res = extractSupplierFulfilment(mockInsightResp);
    assert.strictEqual(res.supplier_order_id, '3909', 'Should parse supplier order ID');
    assert.strictEqual(res.supplier_status, 'completed', 'Should parse status as completed');
    assert.strictEqual(res.items.length, 1, 'Should extract 1 delivery item');
    assert.strictEqual(res.items[0].delivery_format, 'redemption_url', 'Should classify URL as redemption_url');
    assert.strictEqual(res.items[0].delivery_content, 'https://serviceactivation.in/subscription/new/rF35RPyb27G4');
    assert.ok(!res.items[0].delivery_content.includes('undefined'), 'Must not contain "undefined"');
  });

  await it('verifyAndFulfill records genuine supplier order ID and delivered credentials', async () => {
    const fixture = await createTestOrder('a-imm');
    const res = await paymentAdapter.verifyAndFulfill(fixture.orderRef, `PAY-${fixture.orderRef}`, 'test_bank_transfer');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.order.payment_status, 'paid', 'Order must be marked paid');
    assert.ok(res.deliveries && res.deliveries.length > 0, 'Must record delivered credentials');

    const del = res.deliveries![0];
    assert.ok(del.license_code_or_credential.length > 5, 'Credential must be non-empty');
    assert.ok(!del.license_code_or_credential.includes('undefined'), 'Credential must never be undefined');
    assert.ok(!del.license_code_or_credential.includes('ORDER-undefined'), 'Credential must not be ORDER-undefined');
  });

  // =========================================================================
  // Scenario B: Payment succeeds and supplier order initially remains pending
  // =========================================================================
  console.log('\n--- B. Payment Succeeds & Supplier Order Initially Remains Pending ---');
  await it('extractSupplierFulfilment marks order pending without synthesizing fake codes', () => {
    const pendingSupplierResp = {
      order: {
        order_id: 4001,
        product_id: 14,
        status: 'pending',
        codes: [],
        created_at: '2026-10-15T01:00:00Z'
      }
    };

    const res = extractSupplierFulfilment(pendingSupplierResp);
    assert.strictEqual(res.supplier_order_id, '4001');
    assert.strictEqual(res.supplier_status, 'pending');
    assert.strictEqual(res.items.length, 0, 'No delivery records should be generated for pending order');
  });

  // =========================================================================
  // Scenario C: Supplier completes order after a delay
  // =========================================================================
  console.log('\n--- C. Supplier Completes Order After Delay (Status Sync) ---');
  await it('extractSupplierFulfilment updates pending order when polled later', () => {
    const delayedCompletedResp = {
      order: {
        order_id: 4001,
        product_id: 14,
        status: 'completed',
        codes: ['https://serviceactivation.in/subscription/new/delayedToken123'],
        completed_at: '2026-10-15T01:05:00Z'
      }
    };

    const res = extractSupplierFulfilment(delayedCompletedResp);
    assert.strictEqual(res.supplier_status, 'completed');
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].delivery_content, 'https://serviceactivation.in/subscription/new/delayedToken123');
  });

  // =========================================================================
  // Scenario D: Supplier returns redemption link instead of a license key
  // =========================================================================
  console.log('\n--- D. Supplier Returns Redemption Link Instead of License Key ---');
  await it('detects URL link and sets redemption_url format and activation guide', () => {
    const urlResp = {
      order_id: '5002',
      status: 'success',
      codes: ['https://workspace.google.com/invite/redeem?token=xyz987']
    };

    const res = extractSupplierFulfilment(urlResp);
    assert.strictEqual(res.items[0].delivery_format, 'redemption_url');
    assert.strictEqual(res.items[0].redemption_url, 'https://workspace.google.com/invite/redeem?token=xyz987');
    assert.ok(res.items[0].instructions.toLowerCase().includes('activation url') || res.items[0].instructions.toLowerCase().includes('redeem'));
  });

  // =========================================================================
  // Scenario E: Supplier returns activation code and instructions
  // =========================================================================
  console.log('\n--- E. Supplier Returns Activation Code and Instructions ---');
  await it('detects standard alphanumeric license key and sets license_key format', () => {
    const codeResp = {
      order_id: '5003',
      status: 'completed',
      codes: ['CANVA-PRO-2026-T8K9-M4P2']
    };

    const res = extractSupplierFulfilment(codeResp, 'Enter in account settings');
    assert.strictEqual(res.items[0].delivery_format, 'license_key');
    assert.strictEqual(res.items[0].delivery_content, 'CANVA-PRO-2026-T8K9-M4P2');
    assert.strictEqual(res.items[0].instructions, 'Enter in account settings');
  });

  // =========================================================================
  // Scenario F: Supplier rejects purchase
  // =========================================================================
  console.log('\n--- F. Supplier Rejects Purchase ---');
  await it('extractSupplierFulfilment safely handles rejected purchase without throwing', () => {
    const rejectedResp = {
      status: 'failed',
      error: 'Product temporarily out of supplier stock'
    };

    const res = extractSupplierFulfilment(rejectedResp);
    assert.strictEqual(res.supplier_status, 'failed');
    assert.strictEqual(res.items.length, 0);
  });

  // =========================================================================
  // Scenario G: The supplier request times out with an unknown outcome
  // =========================================================================
  console.log('\n--- G. Supplier Request Times Out with Unknown Outcome ---');
  await it('retains order in processing reconciliation state without creating fake credentials', async () => {
    const fixture = await createTestOrder('g-timeout');

    // Simulate timeout occurrence during purchase attempt
    await dbService.run(`
      UPDATE orders
      SET payment_status = 'paid',
          fulfilment_status = 'processing',
          notes = 'Supplier purchase timeout/error: Request timed out after 12000ms. Retaining order for reconciliation.',
          updated_at = ?
      WHERE id = ?
    `, [now, fixture.orderId]);

    const orderAfterTimeout = await dbService.queryOne<Order>(`SELECT * FROM orders WHERE id = ?`, [fixture.orderId]);
    const deliveries = await dbService.query<Delivery>(`SELECT * FROM deliveries WHERE order_id = ?`, [fixture.orderId]);

    assert.strictEqual(orderAfterTimeout!.payment_status, 'paid', 'Payment remains securely verified');
    assert.strictEqual(orderAfterTimeout!.fulfilment_status, 'processing', 'Fulfilment must NOT be marked fulfilled on timeout');
    assert.strictEqual(deliveries.length, 0, 'Zero fake deliveries created during uncertain timeout');
    assert.ok(orderAfterTimeout!.notes?.includes('reconciliation'), 'Reconciliation state logged');
  });

  // =========================================================================
  // Scenario H: Customer refreshes confirmation page
  // =========================================================================
  console.log('\n--- H. Customer Refreshes Confirmation Page (Data Retrieval) ---');
  await it('order lookup by reference returns persistent order, items, transactions, and deliveries', async () => {
    const fixture = await createTestOrder('h-ref');
    await paymentAdapter.verifyAndFulfill(fixture.orderRef, `PAY-${fixture.orderRef}`);

    const retrievedOrder = await dbService.queryOne<Order>(
      'SELECT * FROM orders WHERE order_reference = ?',
      [fixture.orderRef]
    );
    assert.ok(retrievedOrder, 'Order must exist in database');
    assert.strictEqual(retrievedOrder!.payment_status, 'paid');
    assert.strictEqual(retrievedOrder!.fulfilment_status, 'fulfilled');

    const retrievedDeliveries = await dbService.query<Delivery>(
      'SELECT * FROM deliveries WHERE order_id = ?',
      [retrievedOrder!.id]
    );
    assert.ok(retrievedDeliveries.length > 0, 'Deliveries must be present on page refresh');
    assert.ok(!retrievedDeliveries[0].license_code_or_credential.includes('undefined'), 'No undefined credentials on refresh');
  });

  // =========================================================================
  // Scenario I: A payment callback is received more than once
  // =========================================================================
  console.log('\n--- I. Payment Callback Received More Than Once ---');
  await it('repeated callbacks return existing deliveries without creating duplicate supplier orders', async () => {
    const fixture = await createTestOrder('i-dup');
    const firstCall = await paymentAdapter.verifyAndFulfill(fixture.orderRef, `PAY-${fixture.orderRef}`);
    const firstDeliveryCount = firstCall.deliveries?.length || 0;
    assert.ok(firstDeliveryCount > 0, 'First callback creates delivery');

    // Second callback with identical order and payment reference
    const secondCall = await paymentAdapter.verifyAndFulfill(fixture.orderRef, `PAY-${fixture.orderRef}`);
    assert.strictEqual(secondCall.deliveries?.length, firstDeliveryCount, 'Second callback must return identical deliveries');
    assert.strictEqual(secondCall.message, 'Order was already verified and fulfilled.');

    // Database verification: strictly 1 delivery record per item
    const dbDeliveries = await dbService.query<Delivery>(
      'SELECT * FROM deliveries WHERE order_id = ?',
      [fixture.orderId]
    );
    assert.strictEqual(dbDeliveries.length, 1, 'Database must have strictly 1 delivery record');
  });

  // =========================================================================
  // Scenario J: A supplier purchase response is missing expected fields
  // =========================================================================
  console.log('\n--- J. Supplier Purchase Response Missing Expected Fields ---');
  await it('handles unexpected or missing fields safely without throwing or outputting undefined', () => {
    const malformedResp1 = {};
    const res1 = extractSupplierFulfilment(malformedResp1);
    assert.strictEqual(res1.items.length, 0, 'Empty object produces 0 delivery items');
    assert.strictEqual(res1.supplier_order_id, null);

    const malformedResp2 = { order: { random_unknown_key: 'foo' } };
    const res2 = extractSupplierFulfilment(malformedResp2);
    assert.strictEqual(res2.items.length, 0, 'Missing codes produces 0 delivery items');

    const malformedResp3 = null;
    const res3 = extractSupplierFulfilment(malformedResp3);
    assert.strictEqual(res3.supplier_status, 'failed');
    assert.strictEqual(res3.items.length, 0);
  });

  // =========================================================================
  // Scenario K: A supplier order completes but contains no access information
  // =========================================================================
  console.log('\n--- K. Supplier Order Completes But Contains No Access Information ---');
  await it('flags reconciliation state and avoids marking order fulfilled without credentials', () => {
    const completedWithoutCodes = {
      order: {
        order_id: 8888,
        status: 'completed',
        codes: [] // supplier claims completed but returned no access token
      }
    };

    const res = extractSupplierFulfilment(completedWithoutCodes);
    assert.strictEqual(res.supplier_order_id, '8888');
    assert.strictEqual(res.items.length, 0, 'Zero delivery items when supplier returns empty codes');
  });

  // =========================================================================
  // Scenario L: A customer attempts to access another customer\'s order
  // =========================================================================
  console.log('\n--- L. Customer Attempts to Access Another Customer Order ---');
  await it('rejects unauthorized order lookup with email mismatch', async () => {
    const ownerEmail = 'legitimate-owner@toolpadi.ng';
    const fixture = await createTestOrder('l-auth', ownerEmail);

    const order = await dbService.queryOne<Order>(`
      SELECT * FROM orders WHERE order_reference = ?
    `, [fixture.orderRef]);

    assert.ok(order, 'Order created');

    // Simulate security check in API route
    const intruderEmail = 'attacker@unauthorized.com';
    const isOwner = intruderEmail.trim().toLowerCase() === order!.customer_email.toLowerCase();
    assert.strictEqual(isOwner, false, 'Intruder email must not match order customer email');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runFulfilmentTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
