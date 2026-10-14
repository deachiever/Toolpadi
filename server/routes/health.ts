import { Router } from 'express';
import { dbService } from '../db/index.js';
import { insightXProClient } from '../supplier/insightxpro.js';
import { paymentAdapter } from '../payments/adapter.js';
import { schedulerAdapter } from '../adapters/scheduler.adapter.js';
import { emailAdapter } from '../adapters/email.adapter.js';
import { storageAdapter } from '../adapters/storage.adapter.js';

export const healthRouter = Router();

// Liveness check (Kube / Cloud Run / VPS supervisor)
healthRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Readiness check (Database pool & backend adapters)
healthRouter.get('/ready', async (req, res) => {
  try {
    const dbHealth = await dbService.getHealth();
    const isReady = dbHealth.connected;

    const responsePayload = {
      status: isReady ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      adapters: {
        payment_mode: paymentAdapter.getMode(),
        is_live_payments: paymentAdapter.isLiveEnabled(),
        supplier_configured: insightXProClient.isConfigured(),
        email_provider: emailAdapter.getProvider(),
        storage_provider: storageAdapter.getProvider(),
        scheduler_mode: schedulerAdapter.getMode()
      }
    };

    if (isReady) {
      res.status(200).json(responsePayload);
    } else {
      res.status(503).json(responsePayload);
    }
  } catch (err: any) {
    res.status(503).json({
      status: 'unavailable',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Webhook trigger for Cloud Scheduler (Cloud Run / External Cron)
healthRouter.post('/cron/maintenance', async (req, res) => {
  const secret = process.env.CRON_SECRET || 'TOOLPADI_MAINTENANCE_CRON_KEY';
  const headerKey = req.headers['x-cron-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (headerKey !== secret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret key.' });
  }

  try {
    const result = await schedulerAdapter.runScheduledMaintenance();
    res.status(200).json({ status: 'success', maintenance: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
