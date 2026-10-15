-- ToolPadi Phase 2: Supplier Fulfilment and Digital Delivery Schema Migration

ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_order_id VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_reference VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_status VARCHAR(50) DEFAULT 'unprocessed';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_raw_response TEXT;

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_format VARCHAR(50) DEFAULT 'license_key';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS redemption_url TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS supplier_order_id VARCHAR(128);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS raw_code_or_link TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_supplier_order_id ON orders(supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplier_order_id ON deliveries(supplier_order_id);
