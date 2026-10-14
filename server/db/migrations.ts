export interface Migration {
  id: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: 1,
    name: 'initial_schema_v2',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL DEFAULT 'insightxpro',
        source_product_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        short_description TEXT NOT NULL,
        description TEXT NOT NULL,
        description_text TEXT,
        category TEXT NOT NULL DEFAULT 'General',
        access_type TEXT NOT NULL DEFAULT 'digital_access',
        duration TEXT NOT NULL DEFAULT 'as_specified',
        supplier_cost_usdt REAL NOT NULL DEFAULT 0.0,
        supplier_base_cost_usdt REAL,
        supplier_cost_ngn REAL NOT NULL DEFAULT 0.0,
        stock_count INTEGER NOT NULL DEFAULT 0,
        is_unlimited INTEGER NOT NULL DEFAULT 0,
        is_supplier_available INTEGER NOT NULL DEFAULT 1,
        reseller_approved INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 0,
        purchasable_override INTEGER NOT NULL DEFAULT 1,
        max_order_quantity INTEGER DEFAULT 0,
        bulk_pricing_enabled INTEGER NOT NULL DEFAULT 0,
        bulk_pricing_mode TEXT NOT NULL DEFAULT 'discount_percent',
        raw_supplier_payload TEXT,
        terms_of_service TEXT NOT NULL DEFAULT 'Standard supplier terms apply.',
        delivery_instructions TEXT NOT NULL DEFAULT 'Instant digital delivery upon verified payment.',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_synced_at TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_unique ON products(source_type, source_product_id);

      CREATE TABLE IF NOT EXISTS pricing_rules (
        id TEXT PRIMARY KEY,
        product_id TEXT UNIQUE NOT NULL,
        pricing_mode TEXT NOT NULL DEFAULT 'percentage_markup',
        calculation_type TEXT NOT NULL DEFAULT 'markup',
        markup_value REAL NOT NULL DEFAULT 20.0,
        manual_price_ngn REAL,
        manual_price_usd REAL,
        reference_price_ngn REAL,
        reference_price_usd REAL,
        reference_source_url TEXT,
        reference_plan_name TEXT,
        reference_verified_at TEXT,
        reference_verified_by TEXT,
        allow_negative_margin INTEGER NOT NULL DEFAULT 0,
        override_reason TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        min_profit_ngn REAL DEFAULT 0.0,
        min_price_ngn REAL DEFAULT 0.0,
        price_locked INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        currency_preference TEXT NOT NULL DEFAULT 'NGN',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_reference TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        total_amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'NGN',
        exchange_rate REAL NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        fulfilment_status TEXT NOT NULL DEFAULT 'unfulfilled',
        idempotency_key TEXT UNIQUE NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_title TEXT NOT NULL,
        unit_price REAL NOT NULL,
        supplier_cost REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        access_type TEXT NOT NULL,
        duration TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        order_item_id TEXT NOT NULL,
        delivery_type TEXT NOT NULL,
        license_code_or_credential TEXT NOT NULL,
        delivery_status TEXT NOT NULL DEFAULT 'delivered',
        instructions TEXT NOT NULL,
        access_expires_at TEXT,
        delivered_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (order_item_id) REFERENCES order_items(id)
      );

      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        payment_reference TEXT UNIQUE NOT NULL,
        provider TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL,
        gateway_response TEXT,
        webhook_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        details TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        ticket_reference TEXT UNIQUE NOT NULL,
        order_reference TEXT,
        customer_email TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        subject TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL
      );
    `
  },
  {
    id: 2,
    name: 'category_pricing_and_profit_engine',
    sql: `
      CREATE TABLE IF NOT EXISTS category_pricing_rules (
        id TEXT PRIMARY KEY,
        category TEXT UNIQUE NOT NULL,
        calculation_type TEXT NOT NULL DEFAULT 'markup',
        percentage REAL NOT NULL DEFAULT 20.0,
        min_profit_ngn REAL DEFAULT 0.0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_category_pricing_cat ON category_pricing_rules(category);
    `
  },
  {
    id: 3,
    name: 'product_level_controls_and_bulk_pricing',
    sql: `
      ALTER TABLE products ADD COLUMN purchasable_override INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE products ADD COLUMN max_order_quantity INTEGER DEFAULT 0;
      ALTER TABLE products ADD COLUMN bulk_pricing_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE products ADD COLUMN bulk_pricing_mode TEXT NOT NULL DEFAULT 'discount_percent';

      CREATE TABLE IF NOT EXISTS product_bulk_pricing_tiers (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        tier_order INTEGER NOT NULL DEFAULT 1,
        min_quantity INTEGER NOT NULL,
        max_quantity INTEGER,
        discount_percentage REAL DEFAULT 0,
        fixed_unit_price_ngn REAL DEFAULT 0,
        fixed_unit_price_usd REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_bulk_tiers_product ON product_bulk_pricing_tiers(product_id);
    `
  }
];
