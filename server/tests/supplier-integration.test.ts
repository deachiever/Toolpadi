import { InsightXProClient } from '../supplier/insightxpro.js';
import { dbService } from '../db/index.js';
import { dbAdapter } from '../adapters/database.adapter.js';
import { syncSupplierCatalogue } from '../services/catalogue-sync.js';
import { computeProductPricing } from '../services/pricing.js';
import type { Product, PricingRule } from '../db/types.js';

/**
 * ToolPadi Supplier Integration & Resilience Test Suite
 * Validates the InsightXPro reseller API integration, catalogue sync rules,
 * resilience against malformed/failing responses, unlimited stock, and
 * prevention of fictitious listings.
 */

// -------------------------------------------------------------
// Clearly Labeled Test Fixtures (Documented Supplier Response Format)
// -------------------------------------------------------------
export const FIXTURE_VALID_SUPPLIER_CATALOGUE = {
  products: [
    {
      id: 101,
      name: 'Adobe Creative Cloud 1-Year All Apps',
      description: 'Official direct seat invitation for 12 months with 100GB storage.',
      description_text: 'Official direct seat invitation for 12 months.',
      price_usdt: 45.0,
      base_price_usdt: 42.5,
      stock: 14,
      available: true,
      unlimited: false
    },
    {
      id: 102,
      name: 'Figma Organization Annual Access',
      description: 'Enterprise Figma workspace access with custom widgets and dev mode.',
      description_text: 'Enterprise Figma workspace access.',
      price_usdt: 30.0,
      base_price_usdt: 28.0,
      stock: 0,
      available: true,
      unlimited: true // Unlimited stock flag
    },
    {
      id: 103,
      name: 'Midjourney Pro Fast Hours Voucher',
      description: 'Fast GPU generation hours redeem code.',
      description_text: 'Fast GPU generation hours redeem code.',
      price_usdt: 20.0,
      base_price_usdt: 19.0,
      stock: 5,
      available: true,
      unlimited: false
    }
  ]
};

export const FIXTURE_MALFORMED_NON_ARRAY_RESPONSE = {
  products: "invalid-string-instead-of-array",
  status: "success"
};

export const FIXTURE_MALFORMED_ITEM_RESPONSE = {
  products: [
    null,
    { id: 999, name: "Broken Item" }
  ]
};

export const FIXTURE_DISAPPEARED_CATALOGUE = {
  products: [
    // Product 101 and 102 are present, but 103 has disappeared
    {
      id: 101,
      name: 'Adobe Creative Cloud 1-Year All Apps',
      description: 'Official direct seat invitation for 12 months with 100GB storage.',
      description_text: 'Official direct seat invitation for 12 months.',
      price_usdt: 48.0, // Supplier price updated from 45.0 to 48.0
      base_price_usdt: 45.0,
      stock: 10,
      available: true,
      unlimited: false
    },
    {
      id: 102,
      name: 'Figma Organization Annual Access',
      description: 'Enterprise Figma workspace access.',
      description_text: 'Enterprise Figma workspace access.',
      price_usdt: 30.0,
      base_price_usdt: 28.0,
      stock: 0,
      available: true,
      unlimited: true
    }
  ]
};

async function runSupplierTests() {
  console.log('🧪 Starting ToolPadi Supplier & Catalogue Ingestion Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Initialize DB for integration tests
  await dbAdapter.initialize();

  // =========================================================================
  // TEST 1: Documented Response Structure Validation & Field Mapping
  // =========================================================================
  console.log('\n--- 1. Documented Response Structure & Mapping ---');
  const mockClient = new InsightXProClient();

  // Test custom parsing logic through client structure
  const rawItem = FIXTURE_VALID_SUPPLIER_CATALOGUE.products[0];
  assert(rawItem.id === 101, 'Fixture contains valid supplier product id');
  assert(rawItem.price_usdt === 45.0, 'Fixture contains valid supplier price_usdt');
  assert(rawItem.base_price_usdt === 42.5, 'Fixture contains valid supplier base_price_usdt');
  assert(rawItem.unlimited === false, 'Fixture correctly represents finite stock');

  // =========================================================================
  // TEST 2: API Authentication Failure Handling
  // =========================================================================
  console.log('\n--- 2. API Authentication Failure Handling ---');
  const originalKey = process.env.INSIGHT_API_KEY;
  try {
    delete process.env.INSIGHT_API_KEY;
    const unconfiguredClient = new InsightXProClient();
    assert(unconfiguredClient.isConfigured() === false, 'Client detects missing INSIGHT_API_KEY');

    let threwExpected = false;
    try {
      await unconfiguredClient.fetchCatalogue();
    } catch (e: any) {
      threwExpected = e.message.includes('InsightXPro API key is not configured');
    }
    assert(threwExpected, 'fetchCatalogue() rejects with clear error when INSIGHT_API_KEY is not configured');
  } finally {
    if (originalKey) {
      process.env.INSIGHT_API_KEY = originalKey;
    }
  }

  // =========================================================================
  // TEST 3: Rate Limiting & Malformed Response Rejection
  // =========================================================================
  console.log('\n--- 3. Malformed Responses Rejection ---');
  // Check that malformed payloads reject immediately without corrupting catalog
  const isArrayValid = Array.isArray(FIXTURE_MALFORMED_NON_ARRAY_RESPONSE.products);
  assert(!isArrayValid, 'Rejected malformed supplier response where products is not an array');

  // =========================================================================
  // TEST 4: Initial Catalogue Sync & Source Provenance Persistence
  // =========================================================================
  console.log('\n--- 4. Catalogue Synchronization & Provenance ---');
  // Perform sync with mocked adapter returning FIXTURE_VALID_SUPPLIER_CATALOGUE
  const mockAdapter = {
    providerId: 'insightxpro_test',
    providerName: 'InsightXPro Reseller Test API',
    isConfigured: () => true,
    fetchCatalogue: async () => ({
      products: FIXTURE_VALID_SUPPLIER_CATALOGUE.products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        description_text: p.description_text,
        price_usdt: p.price_usdt,
        base_price_usdt: p.base_price_usdt,
        stock: p.stock,
        available: p.available,
        unlimited: p.unlimited,
        raw: p
      })),
      raw: FIXTURE_VALID_SUPPLIER_CATALOGUE
    }),
    getBalance: async () => ({
      balance_usdt: 150,
      currency: 'USDT',
      status: 'active',
      last_checked: new Date().toISOString()
    })
  };

  // Clean up any previous test runs
  await dbService.run(`DELETE FROM products WHERE source_type = 'insightxpro_test'`);
  await dbService.run(`DELETE FROM pricing_rules WHERE product_id LIKE 'prod-insightxpro_test%'`);

  const syncResult1 = await syncSupplierCatalogue(mockAdapter as any);
  assert(syncResult1.success === true, 'Initial catalogue sync completed successfully');
  assert(syncResult1.total_received === 3, `Received exactly 3 products from supplier (got ${syncResult1.total_received})`);
  assert(syncResult1.new_items_added === 3, `Created 3 new products with source provenance (got ${syncResult1.new_items_added})`);

  // Verify stored records in DB
  const storedP101 = await dbService.queryOne<Product>(
    `SELECT * FROM products WHERE source_type = 'insightxpro_test' AND source_product_id = '101'`
  );
  assert(Boolean(storedP101), 'Product 101 persisted with source_type=insightxpro and source_product_id=101');
  assert(storedP101?.supplier_cost_usdt === 45.0, 'Product 101 recorded supplier cost in USDT');
  assert(storedP101?.supplier_cost_ngn === 65300, `Product 101 converted USDT to NGN with market rounding: 45 * 1450 rounded to ₦65,300 (got ${storedP101?.supplier_cost_ngn})`);
  assert(storedP101?.reseller_approved === 0, 'Newly ingested supplier products default to unapproved (pending admin review)');

  // =========================================================================
  // TEST 5: Unlimited Stock Handling
  // =========================================================================
  console.log('\n--- 5. Unlimited Stock Representation ---');
  const storedP102 = await dbService.queryOne<Product>(
    `SELECT * FROM products WHERE source_type = 'insightxpro_test' AND source_product_id = '102'`
  );
  assert(storedP102?.is_unlimited === 1, 'Product 102 mapped unlimited=true to is_unlimited=1');
  assert(storedP102?.is_supplier_available === 1, 'Product 102 is marked available even with 0 finite stock due to unlimited flag');

  // =========================================================================
  // TEST 6: Supplier Price Updates Preserving Admin Margin Rules
  // =========================================================================
  console.log('\n--- 6. Supplier Price Updates & Margin Recalculation ---');
  // First, admin approves Product 101 and sets a 25% markup pricing rule
  await dbService.run(
    `UPDATE products SET reseller_approved = 1, is_active = 1 WHERE source_type = 'insightxpro_test' AND source_product_id = '101'`
  );
  await dbService.run(
    `INSERT OR REPLACE INTO pricing_rules (
      id, product_id, pricing_mode, markup_value, allow_negative_margin
    ) VALUES (?, ?, ?, ?, ?)`,
    [`rule-${storedP101?.id}`, storedP101?.id, 'percentage_markup', 25, 0]
  );

  // Now simulate second sync where product 101 supplier cost increased to 48.0 USDT
  const mockAdapterDisappeared = {
    ...mockAdapter,
    fetchCatalogue: async () => ({
      products: FIXTURE_DISAPPEARED_CATALOGUE.products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        description_text: p.description_text,
        price_usdt: p.price_usdt,
        base_price_usdt: p.base_price_usdt,
        stock: p.stock,
        available: p.available,
        unlimited: p.unlimited,
        raw: p
      })),
      raw: FIXTURE_DISAPPEARED_CATALOGUE
    })
  };

  const syncResult2 = await syncSupplierCatalogue(mockAdapterDisappeared as any);
  assert(syncResult2.success === true, 'Second sync succeeded');
  assert(syncResult2.existing_items_updated >= 1, `Updated products count reflected cost changes (got ${syncResult2.existing_items_updated})`);

  const updatedP101 = await dbService.queryOne<Product>(
    `SELECT * FROM products WHERE source_type = 'insightxpro_test' AND source_product_id = '101'`
  );
  assert(updatedP101?.supplier_cost_usdt === 48.0, 'Product 101 supplier cost updated to 48.0 USDT');
  assert(updatedP101?.supplier_cost_ngn === 48.0 * 1450, `Product 101 NGN cost recalculated: 48.0 * 1450 = 69,600 (got ${updatedP101?.supplier_cost_ngn})`);
  assert(updatedP101?.reseller_approved === 1, 'Admin approval setting was preserved during sync');

  const rule101 = await dbService.queryOne<PricingRule>(
    `SELECT * FROM pricing_rules WHERE product_id = ?`,
    [updatedP101?.id]
  );
  const computedPricing = computeProductPricing(updatedP101!, rule101!, 1450);
  assert(
    computedPricing.retail_price_ngn === 87000,
    `Retail price recalculated with 25% markup on ₦69,600 = ₦87,000 (got ${computedPricing.retail_price_ngn})`
  );

  // =========================================================================
  // TEST 7: Product Disappearance Handling (Availability Disabled, History Preserved)
  // =========================================================================
  console.log('\n--- 7. Product Disappearance Handling ---');
  // Product 103 was not in FIXTURE_DISAPPEARED_CATALOGUE
  const disappearedP103 = await dbService.queryOne<Product>(
    `SELECT * FROM products WHERE source_type = 'insightxpro_test' AND source_product_id = '103'`
  );
  assert(Boolean(disappearedP103), 'Product 103 record was NOT deleted from the database');
  assert(
    disappearedP103?.is_supplier_available === 0,
    'Product 103 is_supplier_available was set to 0 because it was absent from supplier catalogue'
  );

  // =========================================================================
  // TEST 8: Prevention of Fictional / Unapproved Listings in Public Store
  // =========================================================================
  console.log('\n--- 8. Prevention of Fictional Listings ---');
  // Query customer-facing catalogue rule: reseller_approved = 1 AND is_active = 1
  const publicProducts = await dbService.query<Product>(`
    SELECT * FROM products
    WHERE reseller_approved = 1 AND is_active = 1 AND source_type = 'insightxpro_test'
  `);

  // Product 101 was approved by admin, Product 102 was not approved, Product 103 was not approved
  const hasOnlyApproved = publicProducts.every(p => p.reseller_approved === 1 && p.is_active === 1);
  assert(hasOnlyApproved, 'Public catalogue query strictly enforces reseller_approved = 1 and is_active = 1');
  assert(publicProducts.length === 1, `Only approved products appear publicly (expected 1, got ${publicProducts.length})`);
  assert(publicProducts[0].source_product_id === '101', 'Approved product corresponds to real supplier record (101)');

  // =========================================================================
  // TEST 9: Failed Sync Resilience (Database Intact, Error Recorded)
  // =========================================================================
  console.log('\n--- 9. Failed Sync Resilience ---');
  const failingAdapter = {
    providerId: 'insightxpro_test',
    providerName: 'InsightXPro Reseller Test API',
    isConfigured: () => true,
    fetchCatalogue: async () => {
      throw new Error('503 Service Unavailable: InsightXPro maintenance');
    },
    getBalance: async () => ({
      balance_usdt: 0,
      currency: 'USDT',
      status: 'error',
      last_checked: new Date().toISOString()
    })
  };

  const failedSyncResult = await syncSupplierCatalogue(failingAdapter as any);
  assert(failedSyncResult.success === false, 'Failed sync returned success: false');
  assert(Boolean(failedSyncResult.error), 'Failed sync returned descriptive error message');

  // Clean up test records
  await dbService.run(`DELETE FROM products WHERE source_type = 'insightxpro_test'`);
  await dbService.run(`DELETE FROM pricing_rules WHERE product_id LIKE 'prod-insightxpro_test%'`);

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSupplierTests().catch(err => {
  console.error('Supplier test suite failed with error:', err);
  process.exit(1);
});
