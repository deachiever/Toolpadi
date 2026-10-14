-- Migration 001: Initial Schema for PostgreSQL
-- Supports PostgreSQL 14, 15, 16+

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL DEFAULT 'insightxpro',
  source_product_id VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  description_text TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  access_type VARCHAR(50) NOT NULL DEFAULT 'digital_access',
  duration VARCHAR(50) NOT NULL DEFAULT 'as_specified',
  supplier_cost_usdt NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  supplier_base_cost_usdt NUMERIC(10, 2),
  supplier_cost_ngn NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  stock_count INTEGER NOT NULL DEFAULT 0,
  is_unlimited INTEGER NOT NULL DEFAULT 0,
  is_supplier_available INTEGER NOT NULL DEFAULT 1,
  reseller_approved INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 0,
  raw_supplier_payload TEXT,
  terms_of_service TEXT NOT NULL DEFAULT 'Standard supplier terms apply.',
  delivery_instructions TEXT NOT NULL DEFAULT 'Instant digital delivery upon verified payment.',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_unique ON products(source_type, source_product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  pricing_mode VARCHAR(50) NOT NULL DEFAULT 'percentage_markup',
  markup_value NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
  manual_price_ngn NUMERIC(14, 2),
  manual_price_usd NUMERIC(10, 2),
  reference_price_ngn NUMERIC(14, 2),
  reference_price_usd NUMERIC(10, 2),
  reference_source_url TEXT,
  reference_plan_name VARCHAR(255),
  reference_verified_at TIMESTAMP WITH TIME ZONE,
  reference_verified_by VARCHAR(255),
  allow_negative_margin INTEGER NOT NULL DEFAULT 0,
  override_reason TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  currency_preference VARCHAR(10) NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  order_reference VARCHAR(64) UNIQUE NOT NULL,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(id),
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  total_amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  exchange_rate NUMERIC(10, 2) NOT NULL DEFAULT 1450.00,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  fulfilment_status VARCHAR(50) NOT NULL DEFAULT 'unfulfilled',
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(order_reference);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);

CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  product_title VARCHAR(255) NOT NULL,
  unit_price NUMERIC(14, 2) NOT NULL,
  supplier_cost NUMERIC(14, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  access_type VARCHAR(50) NOT NULL,
  duration VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS deliveries (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id VARCHAR(64) NOT NULL REFERENCES order_items(id),
  delivery_type VARCHAR(50) NOT NULL,
  license_code_or_credential TEXT NOT NULL,
  delivery_status VARCHAR(50) NOT NULL DEFAULT 'delivered',
  instructions TEXT NOT NULL,
  access_expires_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_reference VARCHAR(128) UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(50) NOT NULL,
  gateway_response TEXT,
  webhook_verified INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_reference ON payment_transactions(payment_reference);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(64) PRIMARY KEY,
  ticket_reference VARCHAR(64) UNIQUE NOT NULL,
  order_reference VARCHAR(64),
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'activation',
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_reference ON support_tickets(ticket_reference);
