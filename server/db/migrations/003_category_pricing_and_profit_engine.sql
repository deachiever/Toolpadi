-- Migration 003: Category Pricing Rules & Profit Engine Configuration
-- Supports PostgreSQL 14+

CREATE TABLE IF NOT EXISTS category_pricing_rules (
  id VARCHAR(64) PRIMARY KEY,
  category VARCHAR(100) UNIQUE NOT NULL,
  calculation_type VARCHAR(20) NOT NULL DEFAULT 'markup', -- 'markup' or 'margin'
  percentage NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
  min_profit_ngn NUMERIC(14, 2) DEFAULT 0.00,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_category_pricing_cat ON category_pricing_rules(category);

-- Add new profit engine fields to pricing_rules
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS calculation_type VARCHAR(20) DEFAULT 'markup';
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS min_profit_ngn NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS min_price_ngn NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS price_locked INTEGER DEFAULT 0;

-- Seed default pricing settings if missing
INSERT INTO admin_settings (key, value, updated_at)
VALUES 
  ('global_markup_percentage', '20.0', CURRENT_TIMESTAMP),
  ('global_calculation_type', 'markup', CURRENT_TIMESTAMP),
  ('global_min_profit_ngn', '500.0', CURRENT_TIMESTAMP),
  ('global_min_price_ngn', '1000.0', CURRENT_TIMESTAMP),
  ('rounding_rule', 'market_50_100', CURRENT_TIMESTAMP),
  ('min_margin_protection_enabled', '1', CURRENT_TIMESTAMP),
  ('catalogue_sync_interval_minutes', '60', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
