# ToolPadi — Affordable Digital Tools Marketplace

> **Tagline:** Your digital tools, within reach.  
> **Core Message:** Powerful tools. Prices that work for you.  
> **Proposed Brand Status:** ToolPadi is a proposed name pending business-name, trademark, domain, and social-handle validation.

ToolPadi is an Africa-first digital tools marketplace designed for Nigerian and African creators, freelancers, students, entrepreneurs, small businesses, and agencies. It makes essential digital software accessible with competitive, transparent pricing, instant local currency payments (NGN & USD), and automated delivery.

---

## Hosting Portability & Production Architecture

ToolPadi is engineered from the ground up to be **100% portable** across diverse hosting targets without rewriting core business logic:
- **Google Cloud Run:** Stateless container deployment with scale-to-zero, external Secret Manager integration, and Cloud Scheduler webhooks.
- **Linux VPS (Ubuntu/Debian):** Docker Compose deployment with separate application and PostgreSQL containers, persistent volumes, and Nginx reverse proxy with Certbot SSL.
- **Node.js Shared Hosting (cPanel / Plesk / DirectAdmin):** Compatible with cPanel CloudLinux Node.js Selector, external or native PostgreSQL, and Phusion Passenger.

### Architectural Highlights
- **Decoupled Architecture:** Clean separation between the React 19 frontend and Node.js/Express backend.
- **Primary Database:** Native **PostgreSQL** with version-controlled SQL migrations (`server/db/migrations/`), connection pooling, and connection health probes. Includes an automatic portable driver fallback for single-container preview environments.
- **Replaceable Infrastructure Adapters:**
  - Database: `server/adapters/database.adapter.ts` (PostgreSQL primary)
  - Payments: `server/payments/adapter.ts` (`sandbox_simulator`, `paystack`, `flutterwave`)
  - Email: `server/adapters/email.adapter.ts` (`smtp`, `resend`, `sendgrid`, `console_log`)
  - Storage: `server/adapters/storage.adapter.ts` (`local_disk`, `s3_compatible`, `memory`)
  - Scheduler: `server/adapters/scheduler.adapter.ts` (`in_process`, `cloud_webhook`)
  - Supplier: `server/supplier/insightxpro.ts` (`insightxpro` server-side client)
- **Zero Secret Leakage:** Structured JSON logger (`server/utils/logger.ts`) automatically redacts API keys, credentials, payment tokens, and cookies from all logs.
- **Security & Network:** Reverse-proxy trust configuration (`trust proxy`), Helmet-compatible security headers, HSTS, correlation request IDs (`X-Request-Id`), and graceful shutdown (`SIGTERM`, `SIGINT`).

---

## Detailed Guides & Documentation

- [Deployment Guide (Google Cloud Run, VPS, Shared Hosting)](./DEPLOYMENT.md)
- [Host-to-Host Migration & Zero-Downtime Cutover Guide](./MIGRATION_GUIDE.md)
- [REST API Reference Documentation](./docs/api-reference.md)

---

## Quickstart (Local Development with Docker Compose)

```bash
# 1. Clone repository
git clone https://github.com/your-org/toolpadi.git
cd toolpadi

# 2. Configure environment
cp .env.example .env

# 3. Launch PostgreSQL & ToolPadi containers
docker compose up -d

# 4. Access Storefront & Admin
# Storefront: http://localhost:3000
# Health Check: http://localhost:3000/health
# Readiness Probe: http://localhost:3000/ready
# Admin Console: http://localhost:3000 (Click 'Admin Desk', passkey: TOOLPADI_ADMIN_SECURE_KEY_2026)
```

---

## Database Migrations & Backups

```bash
# Run PostgreSQL migrations
npm run migrate

# Create a compressed database backup
./scripts/backup-db.sh

# Restore from a backup file
./scripts/restore-db.sh backups/toolpadi_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## Automated Verification Tests

```bash
npm test
# Runs: npx tsx server/tests/verification.test.ts
# Verifies percentage markup, margin guardrails, stale reference price suppression, and authorization gates.
```

---

## Environment Variables (`.env`)

See `.env.example` for the complete documented template with placeholders. Secrets are stored strictly on the server:

```bash
# Core Settings
NODE_ENV="production"
PORT="3000"

# PostgreSQL Database Connection
DATABASE_URL="postgresql://toolpadi_user:PASSWORD@localhost:5432/toolpadi?sslmode=prefer"

# Supplier API (Server-side only)
INSIGHT_API_KEY="YOUR_INSIGHTXPRO_API_KEY_HERE"

# Admin Authentication
ADMIN_SECRET_KEY="TOOLPADI_ADMIN_SECURE_KEY_2026"

# Payment Adapter ('sandbox_simulator' or 'paystack_live')
PAYMENT_MODE="sandbox_simulator"
PAYMENT_WEBHOOK_SECRET="YOUR_WEBHOOK_SECRET"

# Adapters
EMAIL_PROVIDER="console_log"       # 'console_log', 'smtp', 'resend'
STORAGE_PROVIDER="local_disk"      # 'local_disk', 's3_compatible'
SCHEDULER_MODE="in_process"        # 'in_process' (VPS) or 'cloud_webhook' (Cloud Run)
```

---

## Compliance & Reseller Protection Charter

1. **Wholesale Reseller Gate:** Products cannot be purchased unless marked with `authorized` reseller status following compliance verification.
2. **Transparent Reference Pricing:** Stale reference claims (>30 days old) or claims without an official public URL are systematically stripped by the pricing engine.
3. **Negative-Margin Guardrail:** Prevents setting customer prices below wholesale supplier costs without an explicit, audited administrator justification.
4. **Payment Isolation:** Live payments remain gated until regulatory merchant accreditation is approved.
