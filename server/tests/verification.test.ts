import { computeProductPricing, validatePricingUpdate, isReferencePriceStale } from '../services/pricing.js';
import type { Product, PricingRule } from '../db/types.js';

/**
 * Automated test suite for ToolPadi Phase 1 compliance checks.
 * Run via: npx tsx server/tests/verification.test.ts
 */
async function runVerificationTests() {
  console.log('🧪 Starting ToolPadi Compliance & Pricing Verification Tests...\n');
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

  // TEST 1: Percentage Markup Calculation
  const sampleProduct: Product = {
    id: 'test-p1',
    source_type: 'insightxpro',
    source_product_id: 'ixp-test-01',
    title: 'Test Creative Tool',
    slug: 'test-creative-tool',
    short_description: 'Test',
    description: 'Test',
    description_text: null,
    category: 'Design & Creative',
    access_type: 'workspace_seat',
    duration: '1_year',
    supplier_cost_usdt: 10.0,
    supplier_base_cost_usdt: 10.0,
    supplier_cost_ngn: 14500,
    stock_count: 10,
    is_unlimited: 0,
    is_supplier_available: 1,
    reseller_approved: 1,
    is_active: 1,
    raw_supplier_payload: null,
    terms_of_service: 'Test terms',
    delivery_instructions: 'Invite link',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString()
  };

  const percentRule: PricingRule = {
    id: 'rule-test-1',
    product_id: 'test-p1',
    pricing_mode: 'percentage_markup',
    markup_value: 20, // 20%
    manual_price_ngn: null,
    manual_price_usd: null,
    reference_price_ngn: 25000,
    reference_price_usd: 35.0,
    reference_source_url: 'https://example.com/pricing',
    reference_plan_name: 'Official Annual',
    reference_verified_at: new Date().toISOString(),
    reference_verified_by: 'Compliance Tester',
    allow_negative_margin: 0,
    override_reason: null
  };

  const computed1 = computeProductPricing(sampleProduct, percentRule, 1450);
  assert(
    computed1.retail_price_ngn === 17400,
    `20% markup on ₦14,500 should equal ₦17,400 (got ${computed1.retail_price_ngn})`
  );
  assert(
    computed1.can_purchase === true,
    'Authorized product with stock should be purchasable'
  );
  assert(
    computed1.effective_savings_percent === 30,
    `Effective savings vs ₦25,000 reference should be ~30% (got ${computed1.effective_savings_percent}%)`
  );

  // TEST 2: Negative Margin Guardrail Rejection
  const invalidMarginCheck = validatePricingUpdate(14500, 12000, false);
  assert(
    invalidMarginCheck.isValid === false,
    'Negative margin (Retail ₦12,000 < Cost ₦14,500) must be rejected without override'
  );

  const overriddenMarginCheck = validatePricingUpdate(14500, 12000, true, 'Approved loss leader student campaign');
  assert(
    overriddenMarginCheck.isValid === true,
    'Negative margin allowed when explicitly overridden with 10+ char justification'
  );

  // TEST 3: Stale Reference Price Suppression
  const thirtyTwoDaysAgo = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString();
  const isStale = isReferencePriceStale(thirtyTwoDaysAgo);
  assert(
    isStale === true,
    'Reference price verified 32 days ago must be flagged as stale (> 30 days)'
  );

  const staleRule: PricingRule = {
    ...percentRule,
    reference_verified_at: thirtyTwoDaysAgo
  };
  const computedStale = computeProductPricing(sampleProduct, staleRule, 1450);
  assert(
    computedStale.effective_savings_percent === null,
    'Savings claim must be suppressed (null) when reference benchmark is stale'
  );

  // TEST 4: Reseller Authorization Gate Blocks Checkout
  const unauthorizedProduct: Product = {
    ...sampleProduct,
    reseller_approved: 0
  };
  const computedUnauthorized = computeProductPricing(unauthorizedProduct, percentRule, 1450);
  assert(
    computedUnauthorized.can_purchase === false,
    'Product with reseller_approved=0 must NOT be purchasable'
  );

  // TEST 5: Gross Margin Model Calculation (Cost / [1 - Margin%])
  // Cost = ₦10,000, Margin = 20% -> Retail = 10,000 / 0.8 = 12,500
  const cost10kProduct: Product = {
    ...sampleProduct,
    supplier_cost_ngn: 10000,
    supplier_cost_usdt: 6.90
  };
  const margin20Rule: PricingRule = {
    id: 'rule-margin-20',
    product_id: 'test-p1',
    pricing_mode: 'margin',
    calculation_type: 'margin',
    markup_value: 20,
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
  const computedMargin = computeProductPricing(cost10kProduct, margin20Rule, 1450);
  assert(
    computedMargin.retail_price_ngn === 12500,
    `20% gross margin on ₦10,000 cost must equal ₦12,500 (got ${computedMargin.retail_price_ngn})`
  );
  assert(
    computedMargin.effective_pricing?.margin_percent === 20,
    `Effective gross margin must report exactly 20% (got ${computedMargin.effective_pricing?.margin_percent}%)`
  );

  // TEST 6: Hierarchical Rule Precedence (Product > Category > Global)
  const categoryRuleMap = new Map();
  categoryRuleMap.set('design & creative', {
    id: 'cat-design',
    category: 'Design & Creative',
    calculation_type: 'markup',
    percentage: 30, // 30% category rule
    min_profit_ngn: 0,
    is_active: 1
  });

  // 6a: Product-specific rule overrides category rule
  const computedProductPrecedence = computeProductPricing(cost10kProduct, margin20Rule, 1450, {
    categoryRulesMap: categoryRuleMap,
    globalMarkupPercentage: 15
  });
  assert(
    computedProductPrecedence.effective_pricing?.source === 'product_rule',
    'Product-specific rule must take precedence over category and global rules'
  );
  assert(
    computedProductPrecedence.retail_price_ngn === 12500,
    'Product rule determines price (₦12,500)'
  );

  // 6b: Category rule overrides global default when product rule is null
  const computedCategoryPrecedence = computeProductPricing(cost10kProduct, null, 1450, {
    categoryRulesMap: categoryRuleMap,
    globalMarkupPercentage: 15
  });
  assert(
    computedCategoryPrecedence.effective_pricing?.source === 'category_rule',
    'Category rule must take precedence when no product-specific rule exists'
  );
  assert(
    computedCategoryPrecedence.retail_price_ngn === 13000,
    `30% category markup on ₦10,000 must equal ₦13,000 (got ${computedCategoryPrecedence.retail_price_ngn})`
  );

  // 6c: Global default applies when product and category rules are absent
  const unmappedProduct: Product = {
    ...cost10kProduct,
    category: 'Unmapped Category'
  };
  const computedGlobalPrecedence = computeProductPricing(unmappedProduct, null, 1450, {
    categoryRulesMap: categoryRuleMap,
    globalMarkupPercentage: 15
  });
  assert(
    computedGlobalPrecedence.effective_pricing?.source === 'global_default',
    'Global default rule must apply when product and category rules are absent'
  );
  assert(
    computedGlobalPrecedence.retail_price_ngn === 11500,
    `15% global markup on ₦10,000 must equal ₦11,500 (got ${computedGlobalPrecedence.retail_price_ngn})`
  );

  // TEST 7: Minimum Profit Floor Protection
  const smallCostProduct: Product = {
    ...sampleProduct,
    supplier_cost_ngn: 2000
  };
  // 5% markup on 2000 is 100 profit, but min profit floor is 1000
  const minProfitRule: PricingRule = {
    ...percentRule,
    markup_value: 5,
    min_profit_ngn: 1000
  };
  const computedMinProfit = computeProductPricing(smallCostProduct, minProfitRule, 1450);
  assert(
    computedMinProfit.retail_price_ngn === 3000,
    `Min profit floor of ₦1,000 on ₦2,000 cost must ensure retail is ₦3,000 (got ${computedMinProfit.retail_price_ngn})`
  );
  assert(
    computedMinProfit.effective_pricing?.min_profit_applied === true,
    'min_profit_applied flag must be true'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runVerificationTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
