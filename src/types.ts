export interface Product {
  id: string;
  source_type: string;
  source_product_id: string;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  description_text: string | null;
  category: string;
  access_type: string;
  duration: string;
  supplier_cost_usdt: number;
  supplier_base_cost_usdt: number | null;
  supplier_cost_ngn: number;
  stock_count: number;
  is_unlimited: number;
  is_supplier_available: number;
  reseller_approved: number;
  is_active: number;
  purchasable_override?: number;
  max_order_quantity?: number;
  bulk_pricing_enabled?: number;
  bulk_pricing_mode?: 'discount_percent' | 'fixed_unit_price';
  terms_of_service: string;
  delivery_instructions: string;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
  pricing: PricingRule | null;
  retail_price_ngn: number;
  retail_price_usd: number;
  effective_savings_percent: number | null;
  is_reference_stale: boolean;
  can_purchase: boolean;
  block_reason?: string;
  effective_pricing?: {
    source: 'product_manual' | 'product_rule' | 'category_rule' | 'global_default';
    rule_name: string;
    calculation_type: 'markup' | 'margin' | 'fixed_markup' | 'manual';
    rate_percentage: number;
    min_profit_applied: boolean;
    min_price_applied: boolean;
    profit_ngn: number;
    profit_usd: number;
    margin_percent: number;
  };
  bulk_pricing?: {
    enabled: boolean;
    mode: 'discount_percent' | 'fixed_unit_price';
    max_order_quantity: number;
    tiers: BulkPricingTier[];
    unprofitable_tier_ids?: string[];
  };
}

export interface BulkPricingTier {
  id: string;
  product_id: string;
  tier_order: number;
  min_quantity: number;
  max_quantity: number | null;
  discount_percentage: number;
  fixed_unit_price_ngn: number;
  fixed_unit_price_usd: number;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryPricingRule {
  id: string;
  category: string;
  calculation_type: 'markup' | 'margin';
  percentage: number;
  min_profit_ngn: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  product_id: string;
  pricing_mode: 'fixed_markup' | 'percentage_markup' | 'manual' | 'margin';
  calculation_type?: 'markup' | 'margin';
  markup_value: number;
  manual_price_ngn: number | null;
  manual_price_usd: number | null;
  reference_price_ngn: number | null;
  reference_price_usd: number | null;
  reference_source_url: string | null;
  reference_plan_name: string | null;
  reference_verified_at: string | null;
  reference_verified_by: string | null;
  allow_negative_margin: number;
  override_reason: string | null;
  is_active?: number;
  min_profit_ngn?: number | null;
  min_price_ngn?: number | null;
  price_locked?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  order_reference: string;
  customer_id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  total_amount: number;
  currency: 'NGN' | 'USD';
  exchange_rate: number;
  payment_status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
  fulfilment_status: 'unfulfilled' | 'processing' | 'fulfilled' | 'failed';
  idempotency_key: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  deliveries?: Delivery[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  unit_price: number;
  supplier_cost: number;
  quantity: number;
  access_type: string;
  duration: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  order_item_id: string;
  delivery_type: string;
  license_code_or_credential: string;
  delivery_status: 'delivered' | 'pending' | 'revoked';
  instructions: string;
  access_expires_at: string | null;
  delivered_at: string;
}

export interface ConfigData {
  marketplace_name: string;
  tagline: string;
  core_message: string;
  usd_ngn_rate: number;
  payment_mode: string;
  is_live_payment: boolean;
  catalogue_last_synced: string | null;
  catalogue_last_sync_error: string | null;
  supplier_configured: boolean;
  disclaimer: string;
  rounding_policy: string;
}
