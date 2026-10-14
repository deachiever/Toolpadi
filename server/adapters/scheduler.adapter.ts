import { logger } from '../utils/logger.js';
import { insightXProClient } from '../supplier/insightxpro.js';
import { syncSupplierCatalogue } from '../services/catalogue-sync.js';
import { dbService } from '../db/index.js';

export type SchedulerMode = 'in_process' | 'cloud_webhook' | 'disabled';

export class SchedulerAdapter {
  private mode: SchedulerMode;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.mode = (process.env.SCHEDULER_MODE as SchedulerMode) || (process.env.NODE_ENV === 'production' && !process.env.K_SERVICE ? 'in_process' : 'cloud_webhook');
  }

  getMode(): SchedulerMode {
    return this.mode;
  }

  start() {
    if (this.mode === 'in_process') {
      logger.info('Starting in-process background task scheduler (VPS / persistent daemon mode)');
      // Run every 6 hours (21600000 ms)
      this.intervalTimer = setInterval(() => {
        this.runScheduledMaintenance().catch(err => {
          logger.error('Background maintenance job failed', { error: err.message });
        });
      }, 6 * 60 * 60 * 1000);
    } else {
      logger.info('Scheduler configured for external webhook trigger (Cloud Run / Cloud Scheduler mode)');
    }
  }

  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  async runScheduledMaintenance(): Promise<{ syncResult: any; staleChecked: number; timestamp: string }> {
    logger.info('Executing scheduled maintenance: catalogue check & reference-price staleness audit');

    // 1. Sync supplier catalogue if configured
    let syncResult: any = null;
    if (!insightXProClient.isConfigured()) {
      logger.info('InsightXPro API key is not configured. Skipping background sync until configured.');
      syncResult = {
        success: false,
        error: 'InsightXPro API key is not configured. Set INSIGHT_API_KEY in server environment variables to synchronize live products.'
      };
    } else {
      try {
        syncResult = await syncSupplierCatalogue(insightXProClient);
      } catch (err: any) {
        logger.warn('Scheduled catalogue sync failed', { error: err.message });
        syncResult = { success: false, error: err.message };
      }
    }

    // 2. Scan for and flag stale reference prices
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const staleItems = await dbService.query(`
      SELECT product_id, reference_verified_at FROM pricing_rules
      WHERE reference_price_ngn IS NOT NULL AND reference_verified_at < ?
    `, [thirtyDaysAgo]);

    if (staleItems.length > 0) {
      logger.warn(`Found ${staleItems.length} products with stale reference benchmarks (>30 days old). Claims will remain suppressed.`);
    }

    return {
      syncResult,
      staleChecked: staleItems.length,
      timestamp: new Date().toISOString()
    };
  }
}

export const schedulerAdapter = new SchedulerAdapter();
