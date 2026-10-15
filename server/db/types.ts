export interface Product {
  id: string;
  source_type: 'insightxpro' | 'manual' | string;
  source_product_id: string; // e.g. supplier's product ID ("14")
  title: string;
  slug: string;
  short_description: string;
  description: string;
  description_text: string | null;
  category: string;
  access_type: 'account_invite' | 'license_key' | 'workspace_seat' | 'redemption_code' | 'digital_access';
  duration: string;
  supplier_cost_usdt: number;
  supplier_base_cost_usdt: number | null;
  supplier_cost_ngn: number;
  stock_count: number;
  is_unlimited: number; // 1 or 0
  is_supplier_available: number; // 1 if present in live supplier catalogue, 0 if omitted/sold-out
  reseller_approved: number; // 1 if administrator verified authorization and terms, 0 if pending
  is_active: number; // 1 if published to storefront, 0 if hidden
  purchasable_override?: number; // 1 if purchasable, 0 if sales explicitly paused
  max_order_quantity?: number; // maximum quantity per order (0 or null = unlimited)
  bulk_pricing_enabled?: number; // 1 if bulk tiers active, 0 if disabled
  bulk_pricing_mode?: 'discount_percent' | 'fixed_unit_price';
  raw_supplier_payload: string | null;
  terms_of_service: string;
  delivery_instructions: string;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

export interface BulkPricingTier {
  id: string;
  product_id: string;
  tier_order: number;
  min_quantity: number;
  max_quantity: number | null; // null or 0 = no ceiling (e.g. 50+)
  discount_percentage: number;
  fixed_unit_price_ngn: number;
  fixed_unit_price_usd: number;
  created_at: string;
  updated_at: string;
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
  markup_value: number; // e.g. 2500 for fixed NGN or 20 for 20%
  manual_price_ngn: number | null;
  manual_price_usd: number | null;
  reference_price_ngn: number | null;
  reference_price_usd: number | null;
  reference_source_url: string | null;
  reference_plan_name: string | null;
  reference_verified_at: string | null;
  reference_verified_by: string | null;
  allow_negative_margin: number; // 0 or 1
  override_reason: string | null;
  is_active?: number;
  min_profit_ngn?: number | null;
  min_price_ngn?: number | null;
  price_locked?: number;
}

export interface EffectivePricingInfo {
  source: 'product_manual' | 'product_rule' | 'category_rule' | 'global_default';
  rule_name: string;
  calculation_type: 'markup' | 'margin' | 'fixed_markup' | 'manual';
  rate_percentage: number;
  min_profit_applied: boolean;
  min_price_applied: boolean;
  profit_ngn: number;
  profit_usd: number;
  margin_percent: number;
}

export interface ComputedBulkPricing {
  enabled: boolean;
  mode: 'discount_percent' | 'fixed_unit_price';
  max_order_quantity: number;
  tiers: BulkPricingTier[];
  unprofitable_tier_ids?: string[];
}

export interface ComputedProduct extends Product {
  pricing: PricingRule | null;
  retail_price_ngn: number;
  retail_price_usd: number;
  effective_savings_percent: number | null;
  is_reference_stale: boolean;
  can_purchase: boolean;
  block_reason?: string;
  effective_pricing?: EffectivePricingInfo;
  bulk_pricing?: ComputedBulkPricing;
}

export interface Customer {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  currency_preference: 'NGN' | 'USD';
  created_at: string;
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
  supplier_order_id?: string | null;
  supplier_reference?: string | null;
  supplier_status?: string | null;
  supplier_raw_response?: string | null;
  created_at: string;
  updated_at: string;
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
  delivery_format?: 'redemption_url' | 'license_key' | 'coupon_code' | 'account_credentials' | 'activation_code';
  license_code_or_credential: string;
  redemption_url?: string | null;
  supplier_order_id?: string | null;
  raw_code_or_link?: string | null;
  delivery_status: 'delivered' | 'pending' | 'revoked';
  instructions: string;
  access_expires_at: string | null;
  delivered_at: string;
}

export interface PaymentTransaction {
  id: string;
  order_id: string;
  payment_reference: string;
  provider: string;
  amount: number;
  currency: 'NGN' | 'USD';
  status: 'initialized' | 'successful' | 'failed' | 'refunded';
  gateway_response: string | null;
  webhook_verified: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface AdminSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_reference: string;
  order_reference: string | null;
  customer_email: string;
  customer_name: string;
  subject: string;
  category: 'delivery' | 'activation' | 'billing' | 'question';
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
}
