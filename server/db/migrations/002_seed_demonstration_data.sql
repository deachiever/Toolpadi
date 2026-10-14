-- Migration 002: Seed Default Platform Settings Only
-- STRICT COMPLIANCE: Zero mock or invented products are seeded.
-- Products must only originate from real supplier synchronization or explicit manual creation.

INSERT INTO admin_settings (key, value, updated_at) VALUES
  ('usd_ngn_rate', '1450', CURRENT_TIMESTAMP),
  ('pricing_mode_default', 'percentage_markup', CURRENT_TIMESTAMP),
  ('default_percentage_markup', '20', CURRENT_TIMESTAMP),
  ('payment_mode', 'sandbox_simulator', CURRENT_TIMESTAMP),
  ('marketplace_name', 'ToolPadi', CURRENT_TIMESTAMP),
  ('tagline', 'Your digital tools, within reach.', CURRENT_TIMESTAMP),
  ('support_email', 'support@toolpadi.ng', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Clean out any previous mock products from test runs
DELETE FROM pricing_rules WHERE product_id LIKE 'prod-canva%' OR product_id LIKE 'prod-jetbrains%' OR product_id LIKE 'prod-github%' OR product_id LIKE 'prod-freepik%' OR product_id LIKE 'prod-grammarly%' OR product_id LIKE 'prod-coursera%' OR product_id LIKE 'prod-figma%' OR product_id LIKE 'prod-restricted%';

DELETE FROM products WHERE id LIKE 'prod-canva%' OR id LIKE 'prod-jetbrains%' OR id LIKE 'prod-github%' OR id LIKE 'prod-freepik%' OR id LIKE 'prod-grammarly%' OR id LIKE 'prod-coursera%' OR id LIKE 'prod-figma%' OR id LIKE 'prod-restricted%';

INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
VALUES (
  'log-cleanup-mock-data',
  'SYSTEM_INITIALIZER',
  'MOCK_DATA_PURGED',
  'catalogue',
  'all',
  'Purged all hardcoded/mock products. Catalogue now strictly depends on live supplier sync or explicit manual entries.',
  '127.0.0.1',
  CURRENT_TIMESTAMP
);
