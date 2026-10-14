import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { apiRouter } from './server/routes/api.js';
import { adminRouter } from './server/routes/admin.js';
import { healthRouter } from './server/routes/health.js';
import { paymentAdapter } from './server/payments/adapter.js';
import { schedulerAdapter } from './server/adapters/scheduler.adapter.js';
import { dbService } from './server/db/index.js';
import { dbAdapter } from './server/adapters/database.adapter.js';
import { insightXProClient } from './server/supplier/insightxpro.js';
import { logger } from './server/utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  // Initialize primary database and run migrations
  await dbAdapter.initialize();

  // Load persisted supplier credentials into client if configured in admin_settings
  try {
    const keyRow = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'insightxpro_api_key'`);
    const urlRow = await dbService.queryOne<{ value: string }>(`SELECT value FROM admin_settings WHERE key = 'insightxpro_base_url'`);
    if (keyRow?.value || urlRow?.value) {
      insightXProClient.setCredentials(keyRow?.value || null, urlRow?.value || null);
      logger.info('Loaded saved InsightXPro supplier credentials from database configuration');
    }
  } catch (err: any) {
    logger.warn('Could not load saved supplier credentials on bootstrap', { error: err.message });
  }

  // 1. Reverse-Proxy Configuration: Essential for Cloud Run, Nginx, Caddy, Cloudflare, AWS ALB
  app.set('trust proxy', 1);

  // 2. Request Correlation ID & Security Headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // HTTPS Strict-Transport-Security (HSTS) when on secure protocol
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Request start timestamp
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      if (!req.path.startsWith('/health') && !req.path.startsWith('/ready')) {
        logger.info(`${req.method} ${req.originalUrl} [${res.statusCode}] - ${durationMs}ms`, {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs,
          requestId,
          ip: req.ip
        });
      }
    });

    next();
  });

  // 3. Health & Readiness endpoints (at root and /api for compatibility with Cloud Run, K8s, Docker)
  app.use(healthRouter);
  app.use('/api', healthRouter);

  // 4. Parse JSON request bodies
  app.use(express.json({ limit: '10mb' }));

  // 5. Static uploads directory for local disk storage adapter
  const uploadsDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // 6. Signed Webhook endpoint for payment gateways (Paystack / Flutterwave)
  app.post('/api/webhooks/payment', async (req: Request, res: Response) => {
    try {
      const signature = (req.headers['x-paystack-signature'] || req.headers['x-webhook-signature'] || '') as string;
      const payload = req.body;

      logger.info('Received payment webhook notification', { event: payload?.event || 'test_event' });

      // If in sandbox mode, accept simulation events; in live, require cryptographic HMAC
      if (!paymentAdapter.isLiveEnabled()) {
        const orderRef = payload?.data?.reference || payload?.order_reference;
        if (orderRef) {
          await paymentAdapter.verifyAndFulfill(orderRef, `WH-${Date.now()}`, 'webhook_sandbox');
        }
        return res.status(200).json({ status: 'success', received: true });
      }

      const isValid = paymentAdapter.verifyWebhookSignature(JSON.stringify(payload), signature);
      if (!isValid) {
        logger.warn('Rejected invalid webhook signature');
        return res.status(401).json({ error: 'Invalid webhook signature.' });
      }

      if (payload.event === 'charge.success' && payload.data?.reference) {
        await paymentAdapter.verifyAndFulfill(payload.data.reference, payload.data.id || payload.data.reference, 'webhook_live');
      }

      res.status(200).json({ status: 'success' });
    } catch (err: any) {
      logger.error('Webhook processing exception', { error: err.message });
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Mount Core API Routers
  app.use('/api/admin', adminRouter);
  app.use('/api', apiRouter);

  // 8. Serve Frontend (Vite middleware in dev, static dist in production)
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    logger.info('Mounted Vite development middleware');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    logger.info(`Mounted static production assets from ${distPath}`);
  }

  // 9. Start background job scheduler
  schedulerAdapter.start();

  // 10. Start HTTP Listener
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`ToolPadi server running on port ${PORT}`, {
      port: PORT,
      node_env: process.env.NODE_ENV || 'development',
      live_payments: paymentAdapter.isLiveEnabled()
    });
  });

  // 11. Graceful Shutdown Handlers (SIGTERM for Cloud Run/Docker, SIGINT for terminal)
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    schedulerAdapter.stop();

    server.close(async () => {
      logger.info('HTTP server closed. Draining database connection pool...');
      try {
        await dbService.close();
        logger.info('Database pool closed cleanly. Process exit.');
        process.exit(0);
      } catch (err: any) {
        logger.error('Error during database pool closure', { error: err.message });
        process.exit(1);
      }
    });

    // Force exit if drain hangs
    setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded (10s). Forcing termination.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error('Fatal server bootstrap failure', { error: err.message });
  process.exit(1);
});
