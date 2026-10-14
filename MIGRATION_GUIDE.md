# ToolPadi Host-to-Host Migration Guide

This guide documents the exact, reproducible steps required to migrate ToolPadi from one hosting provider to another (for example: from Google Cloud Run to a Linux VPS, or from a VPS to another cloud provider) with zero data loss and minimal downtime.

---

## 1. Pre-Migration Planning & Preparation

### A. Lower DNS TTL (24–48 Hours Before Migration)
Before initiating migration, reduce the Time-to-Live (TTL) on your DNS records (`A`, `AAAA`, `CNAME`) from default 86400 (24h) to **300 seconds (5 minutes)**. This ensures near-instant traffic cutover once the new server is validated.

### B. Maintenance Window Declaration
Select a low-traffic window (e.g. 02:00 AM – 04:00 AM West Africa Time).

---

## 2. Target Server Provisioning

On the **destination server**:
1. Provision the operating environment (Docker Engine on Linux VPS, or new Cloud Run service).
2. Deploy the PostgreSQL database:
   ```bash
   # Create PostgreSQL user and database
   psql -U postgres -c "CREATE USER toolpadi_user WITH PASSWORD 'SECURE_PASSWORD';"
   psql -U postgres -c "CREATE DATABASE toolpadi OWNER toolpadi_user;"
   ```
3. Transfer application code and run database migrations:
   ```bash
   git clone <repo_url> /var/www/toolpadi
   cd /var/www/toolpadi
   npm ci
   npm run build
   ```

---

## 3. Database Export & Data Transfer

### Step 1: Put Old Server into Read-Only Maintenance
To prevent new orders during database transfer:
- Update `.env` on source server or set feature flag in admin panel to temporarily pause checkouts.

### Step 2: Create a Clean Consistent PostgreSQL Dump
Run on the **source server**:
```bash
# Export schema + data with transaction consistency
pg_dump "${SOURCE_DATABASE_URL}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > /tmp/toolpadi_migration_dump.sql.gz

# Check dump file integrity
ls -lh /tmp/toolpadi_migration_dump.sql.gz
```

### Step 3: Securely Transfer Dump to Destination Server
```bash
scp -C /tmp/toolpadi_migration_dump.sql.gz deploy@destination-server-ip:/tmp/
```

### Step 4: Import Dump into Destination PostgreSQL
Run on the **destination server**:
```bash
gunzip -c /tmp/toolpadi_migration_dump.sql.gz | psql "${DESTINATION_DATABASE_URL}"

# Verify table record counts
psql "${DESTINATION_DATABASE_URL}" -c "
  SELECT 'products' as table_name, count(*) FROM products
  UNION ALL
  SELECT 'orders', count(*) FROM orders
  UNION ALL
  SELECT 'deliveries', count(*) FROM deliveries;
"
```

---

## 4. Transfer Uploaded Media Assets (If using Local Disk Storage)
If files or licenses were stored on local disk:
```bash
rsync -avzP -e ssh /var/www/toolpadi/uploads/ deploy@destination-server-ip:/var/www/toolpadi/uploads/
```
*(If using S3 or Cloudflare R2 bucket storage, no file sync is needed—simply point the destination environment variables to the same bucket).*

---

## 5. Secret & Environment Configuration

Copy and verify the destination `.env` file:
```bash
cat << 'EOF' > /var/www/toolpadi/.env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://toolpadi_user:SECURE_PASSWORD@localhost:5432/toolpadi
INSIGHT_API_KEY=your_insightxpro_key
ADMIN_SECRET_KEY=your_admin_secret
PAYMENT_MODE=sandbox_simulator
PAYMENT_WEBHOOK_SECRET=your_webhook_secret
DEFAULT_USD_NGN_RATE=1450
EMAIL_PROVIDER=console_log
STORAGE_PROVIDER=local_disk
SCHEDULER_MODE=in_process
EOF
```

Start the application services:
```bash
# If using Docker Compose:
docker compose up -d

# If using PM2:
pm2 start server.ts --name toolpadi --interpreter tsx
```

---

## 6. Pre-Cutover Smoke Tests (Using Hosts File)
Before changing DNS, verify the new server by adding a local entry to your laptop's `/etc/hosts`:
```
destination-server-ip toolpadi.ng
```
Open your browser and test:
1. `https://toolpadi.ng/health` -> HTTP 200 `{"status":"healthy"}`
2. `https://toolpadi.ng/ready` -> HTTP 200 `{"status":"ready"}`
3. Browse products, add to cart, and perform a simulated checkout.
4. Verify delivered license retrieval on the customer order dashboard.
5. Log into `/admin` and confirm audit logs and stock counters are intact.

---

## 7. DNS & SSL Cutover

1. In your domain registrar or Cloudflare:
   - Change `A` record for `toolpadi.ng` to destination server IP.
   - Change `CNAME` for `www.toolpadi.ng` to target domain/host.
2. If using Nginx on VPS, issue the new SSL certificate:
   ```bash
   sudo certbot --nginx -d toolpadi.ng -d www.toolpadi.ng
   ```
3. Monitor real-time access logs:
   ```bash
   # On destination server
   tail -f /var/log/nginx/access.log
   ```

---

## 8. Post-Migration Cleanup & Rollback Plan

- **Rollback Plan:** If any critical issue occurs during testing, immediately revert the DNS `A` record back to the source server IP (effective within 5 minutes due to the reduced TTL).
- **Post-Migration Clean:** After 48 hours of stable production traffic, restore the DNS TTL back to 86400 (24h) and archive the old server database.
