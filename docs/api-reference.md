# ToolPadi Backend API Reference Documentation

All API routes are served by the Express backend (`server.ts`). JSON is the standard request and response content format.

---

## 1. System & Health Probes

### `GET /health`
Liveness probe for Cloud Run, Kubernetes, and Docker supervisors.
- **Authentication:** Public
- **Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-13T20:50:00.000Z",
  "uptimeSeconds": 1420,
  "environment": "production",
  "version": "1.0.0"
}
```

### `GET /ready`
Readiness probe testing database connection pool and backend adapter initialization.
- **Authentication:** Public
- **Response (200 OK):**
```json
{
  "status": "ready",
  "timestamp": "2026-10-13T20:50:00.000Z",
  "database": {
    "provider": "postgresql",
    "connected": true,
    "active_pool_clients": 1,
    "idle_pool_clients": 4,
    "total_pool_clients": 5,
    "version": "PostgreSQL 16.1"
  },
  "adapters": {
    "payment_mode": "sandbox_simulator",
    "is_live_payments": false,
    "supplier_configured": true,
    "email_provider": "console_log",
    "storage_provider": "local_disk",
    "scheduler_mode": "in_process"
  }
}
```

### `GET /api/config`
Retrieves public marketplace configurations, exchange benchmark rate, and currency rounding policy.
- **Authentication:** Public
- **Response (200 OK):**
```json
{
  "marketplace_name": "ToolPadi",
  "tagline": "Your digital tools, within reach.",
  "core_message": "Powerful tools. Prices that work for you.",
  "usd_ngn_rate": 1450,
  "payment_mode": "sandbox_simulator",
  "is_live_payment": false,
  "catalogue_last_synced": "2026-10-13T10:00:00Z",
  "rounding_policy": "All NGN prices rounded to nearest ₦50 or ₦100."
}
```

### `POST /api/cron/maintenance`
Webhook endpoint for recurring jobs (catalogue sync & reference price freshness audit).
- **Authentication:** Header `x-cron-key: <CRON_SECRET>`

---

## 2. Customer & Storefront Endpoints

### `GET /api/products`
Retrieves approved products with calculated retail prices and verified reference savings.
- **Authentication:** Public
- **Query Parameters:**
  - `category` (string, optional)
  - `access_type` (string, optional)
  - `duration` (string, optional)
  - `search` (string, optional)
- **Response (200 OK):**
```json
{
  "products": [
    {
      "id": "prod-canva-pro-1y",
      "title": "Canva Pro (Team Workspace Seat)",
      "slug": "canva-pro-1-year-seat",
      "category": "Design & Creative",
      "access_type": "workspace_seat",
      "duration": "1_year",
      "retail_price_ngn": 21500,
      "retail_price_usd": 14.99,
      "effective_savings_percent": 37,
      "can_purchase": true
    }
  ],
  "total": 6,
  "exchange_rate": 1450
}
```

### `GET /api/products/:slug`
Retrieves full product specifications, activation instructions, and verified reference citations.
- **Authentication:** Public

### `POST /api/cart/validate`
Validates inventory stock and purchase eligibility before checkout.
- **Request Body:**
```json
{
  "items": [{ "product_id": "prod-canva-pro-1y", "quantity": 1 }]
}
```

### `POST /api/checkout`
Creates an order with idempotency guarantees and initializes the payment session.
- **Request Body:**
```json
{
  "email": "customer@company.com",
  "full_name": "Olusegun Adekunle",
  "phone": "+2348012345678",
  "currency": "NGN",
  "channel": "bank_transfer",
  "idempotency_key": "unique-idempotency-key",
  "items": [{ "product_id": "prod-canva-pro-1y", "quantity": 1 }]
}
```

### `POST /api/payments/verify`
Server-side transaction verification and atomic digital license issuance.
- **Request Body:**
```json
{
  "order_reference": "TP-2026-4819",
  "payment_reference": "PAY-TP-2026-4819-ABC",
  "simulation_channel": "sandbox"
}
```

### `GET /api/orders/:reference`
Retrieves order status and decrypted license credentials.
- **Query Parameter:** `email` (optional security filter)

### `GET /api/customer/orders?email=<email>`
Returns all orders associated with a customer email.

### `POST /api/support/ticket`
Submits a customer inquiry to the operations support desk.

---

## 3. Webhook Receiver

### `POST /api/webhooks/payment`
Receives cryptographically signed webhooks from Paystack or Flutterwave.
- **Headers:** `x-paystack-signature: <hmac_sha512_hash>`

---

## 4. Administration Endpoints
All administration endpoints require the header `x-admin-key: <ADMIN_SECRET_KEY>`.

- `GET /api/admin/overview`: Summary metrics, revenue, and supplier balance.
- `GET /api/admin/products`: Complete inventory with wholesale supplier costs.
- `POST /api/admin/products/:id/approval`: Toggle reseller status (`authorized`, `pending_verification`, `rejected`, `restricted`).
- `POST /api/admin/products/:id/pricing`: Configure fixed markup, percentage markup, manual price, reference benchmark, and negative margin override.
- `POST /api/admin/products/:id/stock`: Update manual stock allocation.
- `POST /api/admin/supplier/sync`: Trigger manual catalogue synchronization with InsightXPro.
- `GET /api/admin/supplier/balance`: Inspect wholesale supplier wallet funds.
- `GET /api/admin/orders`: List all orders and deliveries.
- `POST /api/admin/orders/:id/refund`: Execute refund and revoke delivered license.
- `GET /api/admin/audit-logs`: Immutable stream of all administrative actions.
- `GET /api/admin/settings` & `POST /api/admin/settings`: Manage exchange rates and platform flags.
