import {
  computeBulkUnitPrice,
  validateBulkTiers,
  computeProductPricing
} from '../services/pricing.js';
import type { Product, PricingRule, BulkPricingTier } from '../db/types.js';

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

console.log('🧪 Starting ToolPadi Part 6: Product-Level Controls & Bulk Pricing Tests...\n');

// -------------------------------------------------------------
// Test 1: Individual Product Controls & Separate State Gating
// -------------------------------------------------------------
console.log('--- 1. Separate Product States & Purchase Eligibility ---');

const baseMockProduct: Product = {
  id: 'prod-test-1',
  source_type: 'insightxpro',
  source_product_id: '101',
  title: 'Canva Pro Enterprise Seat',
  slug: 'canva-pro-enterprise-seat',
  short_description: 'Official enterprise team invitation',
  description: 'Full team seat with brand kit',
  description_text: null,
  category: 'Design',
  access_type: 'account_invite',
  duration: '1_year',
  supplier_cost_usdt: 10,
  supplier_base_cost_usdt: 10,
  supplier_cost_ngn: 14500,
  stock_count: 50,
  is_unlimited: 0,
  is_supplier_available: 1,
  reseller_approved: 1,
  is_active: 1,
  purchasable_override: 1,
  max_order_quantity: 25,
  bulk_pricing_enabled: 0,
  bulk_pricing_mode: 'discount_percent',
  raw_supplier_payload: null,
  terms_of_service: 'Terms',
  delivery_instructions: 'Instructions',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_synced_at: new Date().toISOString()
};

const mockRule: PricingRule = {
  id: 'rule-test-1',
  product_id: 'prod-test-1',
  pricing_mode: 'percentage_markup',
  markup_value: 20, // 20% on 14500 = 17400
  manual_price_ngn: null,
  manual_price_usd: null,
  reference_price_ngn: null,
  reference_price_usd: null,
  reference_source_url: null,
  reference_plan_name: null,
  reference_verified_at: null,
  reference_verified_by: null,
  allow_negative_margin: 0,
  override_reason: null
};

// State: All active & purchasable
const comp1 = computeProductPricing(baseMockProduct, mockRule, 1450);
assert(comp1.can_purchase === true, 'Product with approved=1, active=1, purchasable=1 should be purchasable');

// State: purchasable_override = 0 (Sales paused by admin even if approved and active)
const comp2 = computeProductPricing({ ...baseMockProduct, purchasable_override: 0 }, mockRule, 1450);
assert(comp2.can_purchase === false, 'Product with purchasable_override=0 must NOT be purchasable');
assert(comp2.block_reason?.includes('paused by administrators') === true, 'Block reason reflects administrator pause');

// State: unapproved product cannot be purchasable
const comp3 = computeProductPricing({ ...baseMockProduct, reseller_approved: 0 }, mockRule, 1450);
assert(comp3.can_purchase === false, 'Unapproved product (reseller_approved=0) must NOT be purchasable');

// State: hidden storefront cannot be purchasable
const comp4 = computeProductPricing({ ...baseMockProduct, is_active: 0 }, mockRule, 1450);
assert(comp4.can_purchase === false, 'Hidden product (is_active=0) must NOT be purchasable');

// State: upstream unavailable cannot be purchasable
const comp5 = computeProductPricing({ ...baseMockProduct, is_supplier_available: 0 }, mockRule, 1450);
assert(comp5.can_purchase === false, 'Product missing from supplier catalogue (is_supplier_available=0) must NOT be purchasable');

// -------------------------------------------------------------
// Test 2: Automatic Discount Mode Calculation
// -------------------------------------------------------------
console.log('\n--- 2. Bulk Pricing: Automatic Discount Mode ---');

const discountTiers: BulkPricingTier[] = [
  {
    id: 'tier-1',
    product_id: 'prod-test-1',
    tier_order: 1,
    min_quantity: 5,
    max_quantity: 19,
    discount_percentage: 10,
    fixed_unit_price_ngn: 0,
    fixed_unit_price_usd: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'tier-2',
    product_id: 'prod-test-1',
    tier_order: 2,
    min_quantity: 20,
    max_quantity: 49,
    discount_percentage: 20,
    fixed_unit_price_ngn: 0,
    fixed_unit_price_usd: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'tier-3',
    product_id: 'prod-test-1',
    tier_order: 3,
    min_quantity: 50,
    max_quantity: null, // open-ended 50+
    discount_percentage: 30,
    fixed_unit_price_ngn: 0,
    fixed_unit_price_usd: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const bulkConfigDiscount = {
  enabled: true,
  mode: 'discount_percent' as const,
  max_order_quantity: 100,
  tiers: discountTiers
};

// Quantity 3: Below first tier (1-4). Standard retail price applies
const calcQty3 = computeBulkUnitPrice({
  baseRetailNgn: 17400,
  baseRetailUsd: 12.0,
  supplierCostNgn: 14500,
  quantity: 3,
  bulkPricing: bulkConfigDiscount
});
assert(calcQty3.effective_unit_price_ngn === 17400, 'Quantity 3 (below bulk threshold) gets base price ₦17,400');
assert(calcQty3.is_bulk_applied === false, 'Bulk discount is not applied for quantity 3');
assert(calcQty3.total_savings_ngn === 0, 'Zero savings for quantity below tier');

// Quantity 10: Falls into Tier 1 (5–19, 10% discount)
// 17400 * 0.90 = 15660, rounded to nearest 100 = 15700
const calcQty10 = computeBulkUnitPrice({
  baseRetailNgn: 17400,
  baseRetailUsd: 12.0,
  supplierCostNgn: 14500,
  quantity: 10,
  bulkPricing: bulkConfigDiscount
});
assert(calcQty10.is_bulk_applied === true, 'Bulk discount applied for quantity 10');
assert(calcQty10.discount_percent === 10, 'Tier 1 applies exactly 10% discount');
assert(calcQty10.effective_unit_price_ngn === 15700, `Unit price with 10% discount on ₦17,400 rounded is ₦15,700 (got ${calcQty10.effective_unit_price_ngn})`);
assert(calcQty10.total_ngn === 15700 * 10, 'Total is ₦157,000');
assert(calcQty10.total_savings_ngn === (17400 * 10) - (15700 * 10), 'Total savings calculated against standard price');

// Quantity 25: Falls into Tier 2 (20–49, 20% discount)
// 17400 * 0.80 = 13920 -> round to 13900
const calcQty25 = computeBulkUnitPrice({
  baseRetailNgn: 17400,
  baseRetailUsd: 12.0,
  supplierCostNgn: 14500,
  quantity: 25,
  bulkPricing: bulkConfigDiscount
});
assert(calcQty25.discount_percent === 20, 'Tier 2 applies 20% discount');
assert(calcQty25.tier_applied?.min_quantity === 20, 'Matched tier min_quantity is 20');

// Quantity 60: Falls into Tier 3 (50+, 30% discount)
const calcQty60 = computeBulkUnitPrice({
  baseRetailNgn: 17400,
  baseRetailUsd: 12.0,
  supplierCostNgn: 14500,
  quantity: 60,
  bulkPricing: bulkConfigDiscount
});
assert(calcQty60.discount_percent === 30, 'Tier 3 applies 30% discount for open-ended 50+');

// -------------------------------------------------------------
// Test 3: Fixed Unit Price Mode Calculation
// -------------------------------------------------------------
console.log('\n--- 3. Bulk Pricing: Fixed Unit Price Mode ---');

const fixedTiers: BulkPricingTier[] = [
  {
    id: 'fix-1',
    product_id: 'prod-test-2',
    tier_order: 1,
    min_quantity: 5,
    max_quantity: 19,
    discount_percentage: 0,
    fixed_unit_price_ngn: 16000,
    fixed_unit_price_usd: 11.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'fix-2',
    product_id: 'prod-test-2',
    tier_order: 2,
    min_quantity: 20,
    max_quantity: null,
    discount_percentage: 0,
    fixed_unit_price_ngn: 15000,
    fixed_unit_price_usd: 10.34,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const bulkConfigFixed = {
  enabled: true,
  mode: 'fixed_unit_price' as const,
  max_order_quantity: 100,
  tiers: fixedTiers
};

// Quantity 12: Falls into Tier 1 (Fixed ₦16,000)
const calcFix12 = computeBulkUnitPrice({
  baseRetailNgn: 18000,
  baseRetailUsd: 12.5,
  supplierCostNgn: 14000,
  quantity: 12,
  bulkPricing: bulkConfigFixed
});
assert(calcFix12.effective_unit_price_ngn === 16000, 'Tier 1 fixed unit price ₦16,000 applied');
assert(calcFix12.total_ngn === 16000 * 12, 'Total line price ₦192,000');
assert(calcFix12.total_savings_ngn === (18000 - 16000) * 12, 'Total savings is ₦24,000');
assert(calcFix12.unit_profit_ngn === 2000, 'Unit profit is ₦2,000 over ₦14,000 wholesale cost');
assert(calcFix12.is_unprofitable === false, 'Tier 1 is profitable');

// Quantity 25: Falls into Tier 2 (Fixed ₦15,000)
const calcFix25 = computeBulkUnitPrice({
  baseRetailNgn: 18000,
  baseRetailUsd: 12.5,
  supplierCostNgn: 14000,
  quantity: 25,
  bulkPricing: bulkConfigFixed
});
assert(calcFix25.effective_unit_price_ngn === 15000, 'Tier 2 fixed unit price ₦15,000 applied');
assert(calcFix25.unit_profit_ngn === 1000, 'Unit profit is ₦1,000');

// -------------------------------------------------------------
// Test 4: Profit Protection & Unprofitable Tier Detection
// -------------------------------------------------------------
console.log('\n--- 4. Profit Protection & Unprofitable Tiers ---');

// Case A: Fixed tier price (₦13,000) is LOWER than supplier cost (₦14,500)
const calcUnprofitable = computeBulkUnitPrice({
  baseRetailNgn: 18000,
  baseRetailUsd: 12.5,
  supplierCostNgn: 14500,
  quantity: 50,
  bulkPricing: {
    enabled: true,
    mode: 'fixed_unit_price',
    max_order_quantity: 100,
    tiers: [
      {
        id: 'bad-tier',
        product_id: 'p1',
        tier_order: 1,
        min_quantity: 50,
        max_quantity: null,
        discount_percentage: 0,
        fixed_unit_price_ngn: 13000,
        fixed_unit_price_usd: 8.9,
        created_at: '',
        updated_at: ''
      }
    ]
  }
});
assert(calcUnprofitable.is_unprofitable === true, 'Price below supplier cost must flag is_unprofitable = true');
assert(calcUnprofitable.unit_profit_ngn === -1500, 'Negative unit profit (-₦1,500) computed accurately');

// Validation rejects saving unprofitable fixed price without approval
const validationBadFixed = validateBulkTiers(
  [{ min_quantity: 10, fixed_unit_price_ngn: 12000 }],
  'fixed_unit_price',
  14500, // wholesale cost is 14500
  false // allowUnprofitable = false
);
assert(validationBadFixed.isValid === false, 'Fixed tier below wholesale cost must be rejected without override');
assert(validationBadFixed.error?.includes('below wholesale cost') === true, 'Clear error message emitted on negative margin tier');

// Validation allows unprofitable fixed price when explicit admin override is granted
const validationOverridden = validateBulkTiers(
  [{ min_quantity: 10, fixed_unit_price_ngn: 12000 }],
  'fixed_unit_price',
  14500,
  true // allowUnprofitable = true
);
assert(validationOverridden.isValid === true, 'Fixed tier below cost allowed when allowUnprofitable is approved');

// -------------------------------------------------------------
// Test 5: Tier Validation (Overlaps, Ranges, Boundaries)
// -------------------------------------------------------------
console.log('\n--- 5. Tier Validation & Range Safety ---');

// Invalid min_quantity = 0
const valZeroMin = validateBulkTiers([{ min_quantity: 0 }], 'discount_percent', 1000);
assert(valZeroMin.isValid === false, 'Tier with min_quantity < 1 must be rejected');

// Invalid range: max < min (e.g. 20–10)
const valMaxLessMin = validateBulkTiers([{ min_quantity: 20, max_quantity: 10 }], 'discount_percent', 1000);
assert(valMaxLessMin.isValid === false, 'Tier with max_quantity < min_quantity must be rejected');

// Invalid discount percentage (> 100%)
const valOver100 = validateBulkTiers([{ min_quantity: 5, discount_percentage: 120 }], 'discount_percent', 1000);
assert(valOver100.isValid === false, 'Discount percentage > 100% must be rejected');

// Overlapping ranges: [5, 19] and [15, 30]
const valOverlap = validateBulkTiers(
  [
    { min_quantity: 5, max_quantity: 19, discount_percentage: 10 },
    { min_quantity: 15, max_quantity: 30, discount_percentage: 20 }
  ],
  'discount_percent',
  1000
);
assert(valOverlap.isValid === false, 'Overlapping tier ranges [5-19] and [15-30] must be rejected');

// Ambiguous open-ended tier followed by another tier
const valAmbiguous = validateBulkTiers(
  [
    { min_quantity: 10, max_quantity: null, discount_percentage: 15 },
    { min_quantity: 50, max_quantity: 100, discount_percentage: 25 }
  ],
  'discount_percent',
  1000
);
assert(valAmbiguous.isValid === false, 'Open-ended tier followed by another tier must be rejected as ambiguous');

// Clean non-overlapping valid tiers
const valClean = validateBulkTiers(
  [
    { min_quantity: 5, max_quantity: 19, discount_percentage: 10 },
    { min_quantity: 20, max_quantity: 49, discount_percentage: 20 },
    { min_quantity: 50, max_quantity: null, discount_percentage: 30 }
  ],
  'discount_percent',
  1000
);
assert(valClean.isValid === true, 'Strictly non-overlapping sequential tiers pass validation cleanly');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
