-- Migration 004: Product-Level Controls & Bulk Purchase Pricing
-- Supports PostgreSQL 14+

ALTER TABLE products ADD COLUMN IF NOT EXISTS purchasable_override INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_order_quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bulk_pricing_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bulk_pricing_mode VARCHAR(32) NOT NULL DEFAULT 'discount_percent';

CREATE TABLE IF NOT EXISTS product_bulk_pricing_tiers (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  tier_order INTEGER NOT NULL DEFAULT 1,
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER,
  discount_percentage NUMERIC(6, 2) DEFAULT 0.00,
  fixed_unit_price_ngn NUMERIC(14, 2) DEFAULT 0.00,
  fixed_unit_price_usd NUMERIC(14, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bulk_tiers_product ON product_bulk_pricing_tiers(product_id);
