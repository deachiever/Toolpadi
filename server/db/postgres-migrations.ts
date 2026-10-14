import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runPostgresMigrations(pool: pg.Pool): Promise<{ executed: string[]; total: number }> {
  const client = await pool.connect();
  const executedVersions: string[] = [];

  try {
    // 1. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch applied migrations
    const existingRes = await client.query(`SELECT version FROM schema_migrations;`);
    const appliedSet = new Set(existingRes.rows.map(r => r.version));

    // 3. Find migration files
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.warn(`Migrations directory not found at: ${migrationsDir}`);
      return { executed: [], total: 0 };
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.split('_')[0];
      if (!appliedSet.has(version)) {
        logger.info(`Applying PostgreSQL migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf-8');

        await client.query('BEGIN;');
        try {
          await client.query(sqlContent);
          await client.query(
            `INSERT INTO schema_migrations (version, name, executed_at) VALUES ($1, $2, CURRENT_TIMESTAMP);`,
            [version, file]
          );
          await client.query('COMMIT;');
          executedVersions.push(version);
          logger.info(`Successfully applied migration: ${file}`);
        } catch (err: any) {
          await client.query('ROLLBACK;');
          logger.error(`Migration ${file} failed and was rolled back!`, { error: err.message });
          throw err;
        }
      }
    }

    return { executed: executedVersions, total: files.length };
  } finally {
    client.release();
  }
}
