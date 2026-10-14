import { dbService } from '../db/index.js';
import type {
  Product,
  PricingRule,
  CategoryPricingRule,
  ComputedProduct,
  EffectivePricingInfo,
  BulkPricingTier,
  ComputedBulkPricing
} from '../db/types.js';

export const REFERENCE_PRICE_MAX_AGE_DAYS = 30;

export function isReferencePriceStale(verifiedAt: string | null | undefined): boolean {
  if (!verifiedAt) return true;
  const verifiedDate = new Date(verifiedAt).getTime();
  if (isNaN(verifiedDate)) return true;
  const now = Date.now();
  const ageInDays = (now - verifiedDate) / (1000 * 60 * 60 * 24);
  return ageInDays > REFERENCE_PRICE_MAX_AGE_DAYS;
}

export function roundToMarketNaira(amount: number, rule: string = 'market_50_100'): number {
  if (rule === 'none') return Math.round(amount);
  if (rule === 'ceil_100') return Math.ceil(amount / 100) * 100;
  // Default market Nigerian pricing (nearest 50 for <= 1,000; nearest 100 for > 1,000)
  if (amount <= 1000) {
    return Math.round(amount / 50) * 50;
  }
  return Math.round(amount / 100) * 100;
}

export interface PricingEngineOptions {
  categoryRule?: CategoryPricingRule | null;
  categoryRulesMap?: Map<string, CategoryPricingRule>;
  bulkPricingMap?: Map<string, {
    enabled: boolean;
    mode: 'discount_percent' | 'fixed_unit_price';
    max_order_quantity: number;
    tiers: BulkPricingTier[];
  }>;
  globalMarkupPercentage?: number;
  globalCalculationType?: 'markup' | 'margin';
  globalMinProfitNgn?: number;
  globalMinPriceNgn?: number;
  roundingRule?: string;
}

export interface ComputedBulkPrice {
  base_unit_price_ngn: number;
  base_unit_price_usd: number;
  effective_unit_price_ngn: number;
  effective_unit_price_usd: number;
  quantity: number;
  total_ngn: number;
  total_usd: number;
  total_savings_ngn: number;
  total_savings_usd: number;
  tier_applied: BulkPricingTier | null;
  tier_label: string;
  discount_percent: number;
  is_bulk_applied: boolean;
  unit_profit_ngn: number;
  is_unprofitable: boolean;
}

/**
 * Validates quantity tiers to prevent overlapping ranges, invalid quantities, negative prices, and ambiguous rules.
 */
export function validateBulkTiers(
  tiers: Array<{
    min_quantity: number;
    max_quantity?: number | null;
    discount_percentage?: number;
    fixed_unit_price_ngn?: number;
  }>,
  mode: 'discount_percent' | 'fixed_unit_price',
  supplierCostNgn: number,
  allowUnprofitable: boolean = false
): { isValid: boolean; error?: string } {
  if (!tiers || tiers.length === 0) {
    return { isValid: true };
  }

  // Sort by min_quantity
  const sorted = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    const minQty = Number(tier.min_quantity);
    const maxQty = tier.max_quantity && Number(tier.max_quantity) > 0 ? Number(tier.max_quantity) : null;

    if (!minQty || minQty < 1) {
      return {
        isValid: false,
        error: `Tier ${i + 1}: Minimum quantity must be at least 1.`
      };
    }

    if (maxQty !== null && maxQty < minQty) {
      return {
        isValid: false,
        error: `Tier ${i + 1}: Maximum quantity (${maxQty}) cannot be less than minimum quantity (${minQty}).`
      };
    }

    if (mode === 'discount_percent') {
      const disc = Number(tier.discount_percentage ?? 0);
      if (disc < 0 || disc > 100) {
        return {
          isValid: false,
          error: `Tier ${i + 1}: Discount percentage must be between 0% and 100%. Got ${disc}%.`
        };
      }
    } else {
      const fixedPrice = Number(tier.fixed_unit_price_ngn ?? 0);
      if (fixedPrice <= 0) {
        return {
          isValid: false,
          error: `Tier ${i + 1}: Fixed unit price must be greater than zero.`
        };
      }
      if (fixedPrice < supplierCostNgn && !allowUnprofitable) {
        return {
          isValid: false,
          error: `Tier ${i + 1}: Fixed unit price (₦${fixedPrice.toLocaleString()}) is below wholesale cost (₦${supplierCostNgn.toLocaleString()}). Profit protection requires explicit administrator approval.`
        };
      }
    }

    // Check overlap with prior tier
    if (i > 0) {
      const prev = sorted[i - 1];
      const prevMax = prev.max_quantity && Number(prev.max_quantity) > 0 ? Number(prev.max_quantity) : Infinity;
      if (prevMax === Infinity) {
        return {
          isValid: false,
          error: `Ambiguous pricing rule! Tier ${i} is open-ended with no maximum quantity ceiling. Tier ${i + 1} starting at ${minQty} would overlap.`
        };
      }
      if (minQty <= prevMax) {
        return {
          isValid: false,
          error: `Overlapping tier ranges detected! Tier ${i} range (${prev.min_quantity}-${prevMax}) overlaps with Tier ${i + 1} start (${minQty}).`
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Pure authoritative bulk price calculation given product base prices and eligible order quantity
 */
export function computeBulkUnitPrice({
  baseRetailNgn,
  baseRetailUsd,
  supplierCostNgn,
  quantity,
  bulkPricing,
  exchangeRate = 1450,
  roundingRule = 'market_50_100'
}: {
  baseRetailNgn: number;
  baseRetailUsd: number;
  supplierCostNgn: number;
  quantity: number;
  bulkPricing?: ComputedBulkPricing | null;
  exchangeRate?: number;
  roundingRule?: string;
}): ComputedBulkPrice {
  const qty = Math.max(1, Math.floor(quantity));

  if (!bulkPricing || !bulkPricing.enabled || !bulkPricing.tiers || bulkPricing.tiers.length === 0) {
    const totalNgn = baseRetailNgn * qty;
    const totalUsd = Math.round((baseRetailUsd * qty) * 100) / 100;
    return {
      base_unit_price_ngn: baseRetailNgn,
      base_unit_price_usd: baseRetailUsd,
      effective_unit_price_ngn: baseRetailNgn,
      effective_unit_price_usd: baseRetailUsd,
      quantity: qty,
      total_ngn: totalNgn,
      total_usd: totalUsd,
      total_savings_ngn: 0,
      total_savings_usd: 0,
      tier_applied: null,
      tier_label: 'Standard Price',
      discount_percent: 0,
      is_bulk_applied: false,
      unit_profit_ngn: baseRetailNgn - supplierCostNgn,
      is_unprofitable: baseRetailNgn < supplierCostNgn
    };
  }

  // Sort tiers by min_quantity ascending
  const sortedTiers = [...bulkPricing.tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  let matchedTier: BulkPricingTier | null = null;

  for (const tier of sortedTiers) {
    const min = tier.min_quantity;
    const max = (tier.max_quantity && tier.max_quantity > 0) ? tier.max_quantity : Infinity;
    if (qty >= min && qty <= max) {
      matchedTier = tier;
      break;
    }
  }

  if (!matchedTier) {
    // Below first tier bracket -> standard retail price applies
    const totalNgn = baseRetailNgn * qty;
    const totalUsd = Math.round((baseRetailUsd * qty) * 100) / 100;
    return {
      base_unit_price_ngn: baseRetailNgn,
      base_unit_price_usd: baseRetailUsd,
      effective_unit_price_ngn: baseRetailNgn,
      effective_unit_price_usd: baseRetailUsd,
      quantity: qty,
      total_ngn: totalNgn,
      total_usd: totalUsd,
      total_savings_ngn: 0,
      total_savings_usd: 0,
      tier_applied: null,
      tier_label: 'Standard Price',
      discount_percent: 0,
      is_bulk_applied: false,
      unit_profit_ngn: baseRetailNgn - supplierCostNgn,
      is_unprofitable: baseRetailNgn < supplierCostNgn
    };
  }

  let effectiveUnitPriceNgn = baseRetailNgn;
  let effectiveUnitPriceUsd = baseRetailUsd;
  let discountPercent = 0;
  let tierLabel = '';

  if (bulkPricing.mode === 'discount_percent') {
    discountPercent = Math.min(Math.max(0, Number(matchedTier.discount_percentage || 0)), 100);
    const discountedRaw = baseRetailNgn * (1 - discountPercent / 100);
    effectiveUnitPriceNgn = roundToMarketNaira(discountedRaw, roundingRule);
    effectiveUnitPriceUsd = Math.round((baseRetailUsd * (1 - discountPercent / 100)) * 100) / 100;
    const rangeStr = matchedTier.max_quantity && matchedTier.max_quantity > 0
      ? `${matchedTier.min_quantity}-${matchedTier.max_quantity}`
      : `${matchedTier.min_quantity}+`;
    tierLabel = `Bulk Discount (${discountPercent}% off for ${rangeStr} units)`;
  } else {
    // Fixed unit price mode
    effectiveUnitPriceNgn = roundToMarketNaira(Number(matchedTier.fixed_unit_price_ngn || 0), roundingRule);
    effectiveUnitPriceUsd = matchedTier.fixed_unit_price_usd && matchedTier.fixed_unit_price_usd > 0
      ? matchedTier.fixed_unit_price_usd
      : Math.round((effectiveUnitPriceNgn / exchangeRate) * 100) / 100;
    discountPercent = baseRetailNgn > 0
      ? Math.max(0, Math.round(((baseRetailNgn - effectiveUnitPriceNgn) / baseRetailNgn) * 1000) / 10)
      : 0;
    const rangeStr = matchedTier.max_quantity && matchedTier.max_quantity > 0
      ? `${matchedTier.min_quantity}-${matchedTier.max_quantity}`
      : `${matchedTier.min_quantity}+`;
    tierLabel = `Fixed Bulk Tier (₦${effectiveUnitPriceNgn.toLocaleString()} per unit for ${rangeStr} units)`;
  }

  const totalNgn = effectiveUnitPriceNgn * qty;
  const totalUsd = Math.round((effectiveUnitPriceUsd * qty) * 100) / 100;
  const standardTotalNgn = baseRetailNgn * qty;
  const standardTotalUsd = Math.round((baseRetailUsd * qty) * 100) / 100;
  const savingsNgn = Math.max(0, standardTotalNgn - totalNgn);
  const savingsUsd = Math.max(0, Math.round((standardTotalUsd - totalUsd) * 100) / 100);

  const unitProfitNgn = effectiveUnitPriceNgn - supplierCostNgn;
  const isUnprofitable = effectiveUnitPriceNgn < supplierCostNgn;

  return {
    base_unit_price_ngn: baseRetailNgn,
    base_unit_price_usd: baseRetailUsd,
    effective_unit_price_ngn: effectiveUnitPriceNgn,
    effective_unit_price_usd: effectiveUnitPriceUsd,
    quantity: qty,
    total_ngn: totalNgn,
    total_usd: totalUsd,
    total_savings_ngn: savingsNgn,
    total_savings_usd: savingsUsd,
    tier_applied: matchedTier,
    tier_label: tierLabel,
    discount_percent: discountPercent,
    is_bulk_applied: true,
    unit_profit_ngn: unitProfitNgn,
    is_unprofitable: isUnprofitable
  };
}

/**
 * Pure calculation logic for cost -> retail given markup or gross margin
 */
export function calculatePriceFromCost({
  costNgn,
  calculationType = 'markup',
  rate = 20,
  minProfitNgn = 0,
  minPriceNgn = 0,
  roundingRule = 'market_50_100'
}: {
  costNgn: number;
  calculationType?: 'markup' | 'margin';
  rate?: number;
  minProfitNgn?: number;
  minPriceNgn?: number;
  roundingRule?: string;
}): {
  rawRetailNgn: number;
  finalRetailNgn: number;
  minProfitApplied: boolean;
  minPriceApplied: boolean;
} {
  let raw = costNgn;
  const safeRate = Math.max(0, rate);

  if (calculationType === 'margin') {
    // Gross margin formula: Retail = Cost / (1 - margin%)
    // Cap margin at 95% to avoid divide-by-zero or infinite explosions
    const safeMargin = Math.min(safeRate, 95) / 100;
    raw = costNgn / (1 - safeMargin);
  } else {
    // Markup on cost: Retail = Cost * (1 + markup%)
    raw = costNgn * (1 + safeRate / 100);
  }

  let minProfitApplied = false;
  if (minProfitNgn > 0 && (raw - costNgn) < minProfitNgn) {
    raw = costNgn + minProfitNgn;
    minProfitApplied = true;
  }

  let minPriceApplied = false;
  if (minPriceNgn > 0 && raw < minPriceNgn) {
    raw = minPriceNgn;
    minPriceApplied = true;
  }

  const finalRetail = roundToMarketNaira(raw, roundingRule);

  return {
    rawRetailNgn: raw,
    finalRetailNgn: finalRetail,
    minProfitApplied,
    minPriceApplied
  };
}

/**
 * Simulate or preview pricing calculations before saving rules
 */
export function previewPricingCalculation({
  costUsdt,
  exchangeRate = 1450,
  mode = 'percentage_markup',
  calculationType = 'markup',
  rate = 20,
  minProfitNgn = 0,
  minPriceNgn = 0,
  manualPriceNgn,
  roundingRule = 'market_50_100'
}: {
  costUsdt: number;
  exchangeRate?: number;
  mode?: 'percentage_markup' | 'fixed_markup' | 'margin' | 'manual';
  calculationType?: 'markup' | 'margin';
  rate?: number;
  minProfitNgn?: number;
  minPriceNgn?: number;
  manualPriceNgn?: number;
  roundingRule?: string;
}) {
  const costNgn = roundToMarketNaira(costUsdt * exchangeRate, roundingRule);
  let retailNgn = costNgn;
  let minProfitApplied = false;
  let minPriceApplied = false;
  let effectiveCalcType = calculationType;

  if (mode === 'manual' && manualPriceNgn && manualPriceNgn > 0) {
    retailNgn = roundToMarketNaira(manualPriceNgn, roundingRule);
    effectiveCalcType = 'markup';
  } else if (mode === 'fixed_markup') {
    let raw = costNgn + rate;
    if (minProfitNgn > 0 && (raw - costNgn) < minProfitNgn) {
      raw = costNgn + minProfitNgn;
      minProfitApplied = true;
    }
    retailNgn = roundToMarketNaira(raw, roundingRule);
    effectiveCalcType = 'markup';
  } else {
    const calc = calculatePriceFromCost({
      costNgn,
      calculationType: mode === 'margin' ? 'margin' : calculationType,
      rate,
      minProfitNgn,
      minPriceNgn,
      roundingRule
    });
    retailNgn = calc.finalRetailNgn;
    minProfitApplied = calc.minProfitApplied;
    minPriceApplied = calc.minPriceApplied;
    effectiveCalcType = mode === 'margin' ? 'margin' : calculationType;
  }

  const retailUsd = Math.round((retailNgn / exchangeRate) * 100) / 100;
  const profitNgn = retailNgn - costNgn;
  const profitUsd = Math.round((profitNgn / exchangeRate) * 100) / 100;
  const grossMarginPercent = retailNgn > 0 ? Math.round((profitNgn / retailNgn) * 1000) / 10 : 0;
  const markupPercent = costNgn > 0 ? Math.round((profitNgn / costNgn) * 1000) / 10 : 0;

  return {
    cost_usdt: costUsdt,
    cost_ngn: costNgn,
    exchange_rate: exchangeRate,
    retail_price_ngn: retailNgn,
    retail_price_usd: retailUsd,
    profit_ngn: profitNgn,
    profit_usd: profitUsd,
    gross_margin_percent: grossMarginPercent,
    markup_percent: markupPercent,
    calculation_type: effectiveCalcType,
    min_profit_applied: minProfitApplied,
    min_price_applied: minPriceApplied,
    rounding_rule: roundingRule
  };
}

/**
 * Compute Product Pricing enforcing strict rule precedence:
 * 1. Active Product Rule (Fixed manual override, product-specific markup or margin)
 * 2. Active Category Rule (Category-specific markup or margin)
 * 3. Global Default Rule (Default percentage and calculation model from admin settings)
 */
export function computeProductPricing(
  product: Product,
  rule: PricingRule | null,
  exchangeRate: number = 1450,
  options?: PricingEngineOptions
): ComputedProduct {
  const costNgn = product.supplier_cost_ngn;
  const rounding = options?.roundingRule || 'market_50_100';

  let retailNgn = costNgn;
  let retailUsd = product.supplier_cost_usdt;
  let effectivePricing: EffectivePricingInfo;

  // Determine active category rule if available
  const categoryRule = options?.categoryRule || (
    product.category && options?.categoryRulesMap
      ? options.categoryRulesMap.get(product.category.toLowerCase())
      : null
  );

  const isProductRuleActive = Boolean(rule && (rule.is_active === undefined || rule.is_active === 1));
  const isCategoryRuleActive = Boolean(categoryRule && (categoryRule.is_active === undefined || categoryRule.is_active === 1));

  // --- PRECEDENCE 1: ACTIVE PRODUCT-SPECIFIC RULE ---
  if (isProductRuleActive && rule) {
    if (rule.pricing_mode === 'manual' && rule.manual_price_ngn && rule.manual_price_ngn > 0) {
      // Fixed manual retail price override
      retailNgn = roundToMarketNaira(rule.manual_price_ngn, rounding);
      retailUsd = rule.manual_price_usd && rule.manual_price_usd > 0
        ? Math.round(rule.manual_price_usd * 100) / 100
        : Math.round((retailNgn / exchangeRate) * 100) / 100;

      effectivePricing = {
        source: 'product_manual',
        rule_name: 'Product Manual Override',
        calculation_type: 'manual',
        rate_percentage: 0,
        min_profit_applied: false,
        min_price_applied: false,
        profit_ngn: retailNgn - costNgn,
        profit_usd: Math.round(((retailNgn - costNgn) / exchangeRate) * 100) / 100,
        margin_percent: retailNgn > 0 ? Math.round(((retailNgn - costNgn) / retailNgn) * 1000) / 10 : 0
      };
    } else if (rule.pricing_mode === 'fixed_markup') {
      let raw = costNgn + Number(rule.markup_value || 0);
      let minProfitApplied = false;
      const minProfit = rule.min_profit_ngn || 0;
      if (minProfit > 0 && (raw - costNgn) < minProfit) {
        raw = costNgn + minProfit;
        minProfitApplied = true;
      }
      retailNgn = roundToMarketNaira(raw, rounding);
      retailUsd = Math.round((retailNgn / exchangeRate) * 100) / 100;

      effectivePricing = {
        source: 'product_rule',
        rule_name: 'Product Fixed Markup',
        calculation_type: 'fixed_markup',
        rate_percentage: 0,
        min_profit_applied: minProfitApplied,
        min_price_applied: false,
        profit_ngn: retailNgn - costNgn,
        profit_usd: Math.round(((retailNgn - costNgn) / exchangeRate) * 100) / 100,
        margin_percent: retailNgn > 0 ? Math.round(((retailNgn - costNgn) / retailNgn) * 1000) / 10 : 0
      };
    } else {
      // Percentage markup or margin mode
      const calcType = rule.calculation_type || (rule.pricing_mode === 'margin' ? 'margin' : 'markup');
      const calc = calculatePriceFromCost({
        costNgn,
        calculationType: calcType,
        rate: Number(rule.markup_value || 0),
        minProfitNgn: rule.min_profit_ngn || 0,
        minPriceNgn: rule.min_price_ngn || 0,
        roundingRule: rounding
      });

      retailNgn = calc.finalRetailNgn;
      retailUsd = Math.round((retailNgn / exchangeRate) * 100) / 100;

      effectivePricing = {
        source: 'product_rule',
        rule_name: `Product ${calcType === 'margin' ? 'Margin' : 'Markup'} (${rule.markup_value}%)`,
        calculation_type: calcType,
        rate_percentage: Number(rule.markup_value || 0),
        min_profit_applied: calc.minProfitApplied,
        min_price_applied: calc.minPriceApplied,
        profit_ngn: retailNgn - costNgn,
        profit_usd: Math.round(((retailNgn - costNgn) / exchangeRate) * 100) / 100,
        margin_percent: retailNgn > 0 ? Math.round(((retailNgn - costNgn) / retailNgn) * 1000) / 10 : 0
      };
    }
  }
  // --- PRECEDENCE 2: ACTIVE CATEGORY-SPECIFIC RULE ---
  else if (isCategoryRuleActive && categoryRule) {
    const calc = calculatePriceFromCost({
      costNgn,
      calculationType: categoryRule.calculation_type,
      rate: categoryRule.percentage,
      minProfitNgn: categoryRule.min_profit_ngn || 0,
      minPriceNgn: 0,
      roundingRule: rounding
    });

    retailNgn = calc.finalRetailNgn;
    retailUsd = Math.round((retailNgn / exchangeRate) * 100) / 100;

    effectivePricing = {
      source: 'category_rule',
      rule_name: `Category [${categoryRule.category}] ${categoryRule.calculation_type} (${categoryRule.percentage}%)`,
      calculation_type: categoryRule.calculation_type,
      rate_percentage: categoryRule.percentage,
      min_profit_applied: calc.minProfitApplied,
      min_price_applied: calc.minPriceApplied,
      profit_ngn: retailNgn - costNgn,
      profit_usd: Math.round(((retailNgn - costNgn) / exchangeRate) * 100) / 100,
      margin_percent: retailNgn > 0 ? Math.round(((retailNgn - costNgn) / retailNgn) * 1000) / 10 : 0
    };
  }
  // --- PRECEDENCE 3: GLOBAL DEFAULT RULE ---
  else {
    const globalType = options?.globalCalculationType || 'markup';
    const globalRate = options?.globalMarkupPercentage ?? 20;
    const globalMinProfit = options?.globalMinProfitNgn ?? 0;
    const globalMinPrice = options?.globalMinPriceNgn ?? 0;

    const calc = calculatePriceFromCost({
      costNgn,
      calculationType: globalType,
      rate: globalRate,
      minProfitNgn: globalMinProfit,
      minPriceNgn: globalMinPrice,
      roundingRule: rounding
    });

    retailNgn = calc.finalRetailNgn;
    retailUsd = Math.round((retailNgn / exchangeRate) * 100) / 100;

    effectivePricing = {
      source: 'global_default',
      rule_name: `Global Default ${globalType} (${globalRate}%)`,
      calculation_type: globalType,
      rate_percentage: globalRate,
      min_profit_applied: calc.minProfitApplied,
      min_price_applied: calc.minPriceApplied,
      profit_ngn: retailNgn - costNgn,
      profit_usd: Math.round(((retailNgn - costNgn) / exchangeRate) * 100) / 100,
      margin_percent: retailNgn > 0 ? Math.round(((retailNgn - costNgn) / retailNgn) * 1000) / 10 : 0
    };
  }

  // Reference pricing analysis
  const hasReference = Boolean(
    rule?.reference_price_ngn &&
    rule.reference_source_url &&
    rule.reference_verified_at
  );

  const stale = hasReference ? isReferencePriceStale(rule?.reference_verified_at) : true;
  let effectiveSavings: number | null = null;

  if (hasReference && !stale && rule?.reference_price_ngn) {
    if (rule.reference_price_ngn > retailNgn) {
      effectiveSavings = Math.round(
        ((rule.reference_price_ngn - retailNgn) / rule.reference_price_ngn) * 100
      );
    }
  }

  // Reseller authorization, purchase eligibility, and individual control enforcement
  let canPurchase = true;
  let blockReason: string | undefined = undefined;

  if (product.reseller_approved !== 1) {
    canPurchase = false;
    blockReason = 'Product is pending administrator resale authorization and terms verification.';
  } else if (product.is_active !== 1) {
    canPurchase = false;
    blockReason = 'Product is currently unlisted by administrators.';
  } else if (product.purchasable_override !== undefined && Number(product.purchasable_override) === 0) {
    canPurchase = false;
    blockReason = 'Product purchasing is temporarily paused by administrators.';
  } else if (product.is_supplier_available !== 1) {
    canPurchase = false;
    blockReason = 'Product is temporarily unavailable or sold out from supplier catalogue.';
  } else if (product.stock_count <= 0 && product.is_unlimited !== 1) {
    canPurchase = false;
    blockReason = 'Currently out of verified stock from supplier.';
  }

  // Bulk pricing attachment and profit protection check
  let computedBulk: any = undefined;
  if (product.bulk_pricing_enabled === 1) {
    const entry = options?.bulkPricingMap?.get(product.id);
    const tiers = entry ? entry.tiers : [];
    const unprofitableIds: string[] = [];
    if (product.bulk_pricing_mode === 'fixed_unit_price') {
      for (const t of tiers) {
        if (Number(t.fixed_unit_price_ngn) < costNgn) {
          unprofitableIds.push(t.id);
        }
      }
    }
    computedBulk = {
      enabled: true,
      mode: product.bulk_pricing_mode || 'discount_percent',
      max_order_quantity: product.max_order_quantity || 0,
      tiers,
      unprofitable_tier_ids: unprofitableIds
    };
  }

  return {
    ...product,
    pricing: rule,
    retail_price_ngn: retailNgn,
    retail_price_usd: retailUsd,
    effective_savings_percent: effectiveSavings,
    is_reference_stale: stale,
    can_purchase: canPurchase,
    block_reason: blockReason,
    effective_pricing: effectivePricing,
    bulk_pricing: computedBulk
  };
}

export function validatePricingUpdate(
  supplierCostNgn: number,
  retailNgn: number,
  allowNegativeMargin: boolean,
  overrideReason?: string
): { isValid: boolean; error?: string } {
  if (retailNgn < supplierCostNgn) {
    if (!allowNegativeMargin) {
      return {
        isValid: false,
        error: `Negative margin detected! Retail price (₦${retailNgn.toLocaleString()}) cannot be lower than supplier cost (₦${supplierCostNgn.toLocaleString()}) without explicit administrator override.`
      };
    }
    if (!overrideReason || overrideReason.trim().length < 10) {
      return {
        isValid: false,
        error: 'Negative margin override requires an explicit, audited business justification reason (minimum 10 characters).'
      };
    }
  }
  return { isValid: true };
}

export async function getPricingEngineContext(): Promise<PricingEngineOptions> {
  try {
    const settingsRows = await dbService.query<{ key: string; value: string }>(`SELECT key, value FROM admin_settings`);
    const settingsMap = new Map<string, string>();
    for (const s of settingsRows) {
      settingsMap.set(s.key, s.value);
    }

    const categoryRules = await dbService.query<CategoryPricingRule>(`SELECT * FROM category_pricing_rules WHERE is_active = 1`);
    const categoryRulesMap = new Map<string, CategoryPricingRule>();
    for (const cr of categoryRules) {
      categoryRulesMap.set(cr.category.toLowerCase(), cr);
    }

    const bulkPricingMap = new Map<string, {
      enabled: boolean;
      mode: 'discount_percent' | 'fixed_unit_price';
      max_order_quantity: number;
      tiers: BulkPricingTier[];
    }>();

    try {
      const tiers = await dbService.query<BulkPricingTier>(`
        SELECT * FROM product_bulk_pricing_tiers ORDER BY min_quantity ASC
      `);
      for (const t of tiers) {
        if (!bulkPricingMap.has(t.product_id)) {
          bulkPricingMap.set(t.product_id, {
            enabled: true,
            mode: 'discount_percent',
            max_order_quantity: 0,
            tiers: []
          });
        }
        bulkPricingMap.get(t.product_id)!.tiers.push(t);
      }
    } catch {
      // Table might not exist yet during migration bootstrap
    }

    return {
      categoryRulesMap,
      bulkPricingMap,
      globalMarkupPercentage: Number(settingsMap.get('global_markup_percentage') || 20),
      globalCalculationType: (settingsMap.get('global_calculation_type') as any) || 'markup',
      globalMinProfitNgn: Number(settingsMap.get('global_min_profit_ngn') || 0),
      globalMinPriceNgn: Number(settingsMap.get('global_min_price_ngn') || 0),
      roundingRule: settingsMap.get('rounding_rule') || 'market_50_100'
    };
  } catch {
    return {
      globalMarkupPercentage: 20,
      globalCalculationType: 'markup',
      globalMinProfitNgn: 0,
      globalMinPriceNgn: 0,
      roundingRule: 'market_50_100'
    };
  }
}
