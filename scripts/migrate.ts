import dotenv from 'dotenv';
import { getPostgresPool, closePostgresPool } from '../server/db/postgres-pool.js';
import { runPostgresMigrations } from '../server/db/postgres-migrations.js';
import { logger } from '../server/utils/logger.js';

dotenv.config();

async function main() {
  logger.info('Starting manual PostgreSQL migration execution...');
  const pool = getPostgresPool();

  try {
    const result = await runPostgresMigrations(pool);
    logger.info(`Migrations complete: ${result.executed.length} executed out of ${result.total} total.`);
    process.exit(0);
  } catch (err: any) {
    logger.error('Migration failed with fatal error', { error: err.message });
    process.exit(1);
  } finally {
    await closePostgresPool();
  }
}

main();
