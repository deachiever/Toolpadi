# ToolPadi Multi-Environment Production Deployment Guide

ToolPadi is built as a portable, production-oriented application designed to run seamlessly across:
1. **Google Cloud Run** (Serverless Container)
2. **Linux VPS** (Ubuntu / Debian with Docker Compose or systemd)
3. **Node.js Shared Hosting** (cPanel / Plesk / DirectAdmin with Node.js Selector)

Core business logic, pricing computations, database migrations, and supplier integrations are strictly isolated behind modular adapters without proprietary vendor lock-in.

---

## 1. Google Cloud Run Deployment

Google Cloud Run executes ToolPadi inside a lightweight, stateless container with scale-to-zero capabilities.

### Prerequisites
- Google Cloud Project with Cloud Run API and Artifact Registry enabled.
- Managed PostgreSQL instance (Google Cloud SQL for PostgreSQL, Supabase, Neon, or external managed Postgres).
- Google Secret Manager for sensitive environment secrets.

### Step 1: Build & Push Container Image
```bash
# Set Google Cloud Project ID
PROJECT_ID="your-gcp-project-id"
REGION="europe-west2"
REPO="toolpadi-repo"
IMAGE_TAG="v1.0.0"

# Authenticate Docker with Google Artifact Registry
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build and push using production Dockerfile
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/toolpadi:${IMAGE_TAG} .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/toolpadi:${IMAGE_TAG}
```

### Step 2: Store Production Secrets in Secret Manager
```bash
# Add supplier credential
gcloud secrets create INSIGHT_API_KEY --replication-policy="automatic"
echo -n "your_live_insightxpro_api_key" | gcloud secrets versions add INSIGHT_API_KEY --data-file=-

# Add database connection string
gcloud secrets create DATABASE_URL --replication-policy="automatic"
echo -n "postgresql://user:pass@/toolpadi?host=/cloudsql/PROJECT:REGION:INSTANCE" | gcloud secrets versions add DATABASE_URL --data-file=-

# Add admin secret
gcloud secrets create ADMIN_SECRET_KEY --replication-policy="automatic"
echo -n "YOUR_LONG_SECURE_ADMIN_KEY" | gcloud secrets versions add ADMIN_SECRET_KEY --data-file=-
```

### Step 3: Deploy to Cloud Run
```bash
gcloud run deploy toolpadi \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/toolpadi:${IMAGE_TAG} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,DEFAULT_USD_NGN_RATE=1450,PAYMENT_MODE=sandbox_simulator,SCHEDULER_MODE=cloud_webhook" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,INSIGHT_API_KEY=INSIGHT_API_KEY:latest,ADMIN_SECRET_KEY=ADMIN_SECRET_KEY:latest"
```

### Step 4: Configure Cloud Scheduler (Background Jobs)
Because Cloud Run scales to zero, recurring jobs are scheduled externally:
```bash
gcloud scheduler jobs create http toolpadi-maintenance \
  --location ${REGION} \
  --schedule "0 */6 * * *" \
  --uri "https://your-cloud-run-url.a.run.app/api/cron/maintenance" \
  --http-method POST \
  --headers "x-cron-key=YOUR_CRON_SECRET"
```

---

## 2. Linux VPS Deployment (Docker Compose & Nginx)

Ideal for independent Ubuntu 22.04 / 24.04 LTS servers (DigitalOcean, Hetzner, Linode, AWS EC2).

### Prerequisites
- Docker Engine & Docker Compose v2 installed.
- Nginx & Certbot for SSL.
- Domain pointing to VPS public IP (`A` record to server IPv4).

### Step 1: Server Setup & Code Deployment
```bash
# SSH into your VPS
ssh deploy@your-server-ip

# Clone or transfer application files
git clone https://github.com/your-org/toolpadi.git /var/www/toolpadi
cd /var/www/toolpadi

# Create production environment file
cp .env.example .env
nano .env  # Fill in real production values
```

### Step 2: Launch Docker Compose Services
```bash
# Build app container and launch PostgreSQL
docker compose up -d --build

# Verify container statuses and healthchecks
docker compose ps
docker compose logs -f app
```

### Step 3: Configure Nginx Reverse Proxy with HTTPS
Create `/etc/nginx/sites-available/toolpadi.conf`:
```nginx
server {
    server_name toolpadi.ng www.toolpadi.ng;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy to Node.js application container
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # Uploads caching (optional)
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    listen 80;
}
```

Enable site and acquire free SSL with Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/toolpadi.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt SSL
sudo certbot --nginx -d toolpadi.ng -d www.toolpadi.ng
```

---

## 3. Node.js Shared Hosting Compatibility & Setup

Compatibility with shared hosting environments (such as cPanel with CloudLinux Node.js Selector, Plesk, or DirectAdmin) requires specific prerequisites.

### Compatibility Checklist:
Before attempting deployment on shared hosting, verify the following with your hosting provider:
- [x] **Node.js Version:** Provider must support Node.js v18.0.0 or higher (v20+ recommended).
- [x] **PostgreSQL Access:** Provider must offer PostgreSQL database management (either native cPanel PostgreSQL or external connection permissions on TCP port 5432).
- [x] **Persistent Processes:** Confirm whether the host supports long-running Node.js processes (via Phusion Passenger / PM2) or terminates processes after short idle times.
- [x] **Outgoing HTTPS Networking:** The host must permit outgoing HTTP/HTTPS connections on ports 80/443 so the backend can reach the InsightXPro supplier API (`api.insightxpro.store`) and payment webhook callbacks.

### cPanel Step-by-Step Instructions:
1. Log into cPanel and navigate to **PostgreSQL Database Wizard**. Create database `youruser_toolpadi` and user `youruser_toolpadiuser` with full permissions.
2. Navigate to **Setup Node.js App**:
   - Node.js version: Select **20.x** or **22.x**.
   - Application mode: **Production**.
   - Application root: `toolpadi`.
   - Application URL: `yourdomain.ng` or subdomain.
   - Application startup file: `server.js` or `server.ts`.
3. Upload project files via SFTP or Git Version Control.
4. Set Environment Variables in the cPanel Node.js interface:
   - `DATABASE_URL`: `postgresql://youruser_toolpadiuser:PASSWORD@localhost:5432/youruser_toolpadi`
   - `NODE_ENV`: `production`
   - `INSIGHT_API_KEY`: `your_key`
   - `ADMIN_SECRET_KEY`: `your_secret`
5. In cPanel Terminal:
   ```bash
   npm install --omit=dev
   npm run build
   npx tsx scripts/migrate.ts
   ```
6. Click **Restart Application** in the cPanel Node.js dashboard.

---

## 4. Verification & Smoke Test Checklist
After deploying to any platform, run the following commands to confirm operational readiness:

1. **Liveness Probe:**
   ```bash
   curl -i https://your-domain.ng/health
   # Expected: HTTP 200 {"status":"healthy"}
   ```

2. **Readiness Probe:**
   ```bash
   curl -i https://your-domain.ng/ready
   # Expected: HTTP 200 {"status":"ready","database":{"provider":"postgresql","connected":true}}
   ```

3. **Catalogue API:**
   ```bash
   curl -s https://your-domain.ng/api/products | grep "products"
   ```

4. **Security Headers Check:**
   ```bash
   curl -I https://your-domain.ng/ | grep -i "strict-transport-security"
   ```
