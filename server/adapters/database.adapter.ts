import pg from 'pg';
import { getPostgresPool, testPostgresConnection, closePostgresPool } from '../db/postgres-pool.js';
import { runPostgresMigrations } from '../db/postgres-migrations.js';
import { migrations } from '../db/migrations.js';
import { logger } from '../utils/logger.js';
import initSqlJs, { Database as SqlDatabase } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

export interface DatabaseHealth {
  provider: 'postgresql' | 'sqlite_fallback';
  connected: boolean;
  active_pool_clients?: number;
  idle_pool_clients?: number;
  total_pool_clients?: number;
  version?: string;
  error?: string;
}

let activeProvider: 'postgresql' | 'sqlite_fallback' = 'postgresql';
let fallbackSqliteDb: SqlDatabase | null = null;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'toolpadi.db');

export function toPgSql(sql: string): string {
  // Convert standard '?' placeholders to PostgreSQL '$1, $2, $3...'
  let index = 1;
  let pgSql = sql.replace(/\?/g, () => `$${index++}`);
  // Replace SQLite specific INSERT OR REPLACE with PostgreSQL ON CONFLICT if needed
  if (pgSql.includes('INSERT OR REPLACE INTO admin_settings')) {
    pgSql = pgSql.replace(
      'INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ($1, $2, $3)',
      'INSERT INTO admin_settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at'
    );
  }
  return pgSql;
}

export class DatabaseAdapter {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const hasPgConfig = Boolean(
      process.env.DATABASE_URL ||
      process.env.PGHOST ||
      (process.env.NODE_ENV === 'production')
    );

    if (hasPgConfig) {
      try {
        const pool = getPostgresPool();
        const test = await testPostgresConnection();

        if (test.connected) {
          activeProvider = 'postgresql';
          logger.info('Connected to primary PostgreSQL database', { version: test.version });
          await runPostgresMigrations(pool);
          this.initialized = true;
          return;
        } else {
          logger.warn(`PostgreSQL connection failed (${test.error}). Initializing fallback driver for environment portability.`);
        }
      } catch (err: any) {
        logger.warn(`PostgreSQL init exception: ${err.message}. Using fallback driver.`);
      }
    }

    // Fallback SQLite driver (ensures app operates portably during development/container preview)
    activeProvider = 'sqlite_fallback';
    logger.info('Initializing portable database driver for current environment...');
    await this.initFallbackDb();
    this.initialized = true;
  }

  private async initFallbackDb() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const SQL = await initSqlJs({
      locateFile: (file) => {
        const wasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist', file);
        if (fs.existsSync(wasmPath)) return wasmPath;
        return file;
      }
    });

    if (fs.existsSync(DB_FILE)) {
      const fileBuffer = fs.readFileSync(DB_FILE);
      fallbackSqliteDb = new SQL.Database(fileBuffer);
    } else {
      fallbackSqliteDb = new SQL.Database();
    }

    // Run pending migrations
    const executedMigrations = new Set<number>();
    try {
      const res = fallbackSqliteDb.exec("SELECT id FROM schema_migrations;");
      if (res.length > 0 && res[0].values) {
        for (const val of res[0].values) {
          executedMigrations.add(Number(val[0]));
        }
      }
    } catch {
      // schema_migrations table does not exist yet; will be created by migration 1
    }

    for (const m of migrations) {
      if (!executedMigrations.has(m.id)) {
        logger.info(`Applying SQLite migration ${m.id}: ${m.name}`);
        fallbackSqliteDb.exec(m.sql);
        fallbackSqliteDb.run(
          "INSERT INTO schema_migrations (id, name, executed_at) VALUES (?, ?, ?);",
          [m.id, m.name, new Date().toISOString()]
        );
      }
    }

    // Seed default baseline settings if not set
    try {
      const existingSettings = fallbackSqliteDb.exec("SELECT key FROM admin_settings;");
      const existingKeys = new Set(
        (existingSettings[0]?.values || []).map((row) => String(row[0]))
      );
      const now = new Date().toISOString();
      if (!existingKeys.has('usd_ngn_rate')) {
        fallbackSqliteDb.run("INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, ?)", ['usd_ngn_rate', '1450', now]);
      }
      if (!existingKeys.has('payment_mode')) {
        fallbackSqliteDb.run("INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, ?)", ['payment_mode', 'sandbox_simulator', now]);
      }
      if (!existingKeys.has('default_percentage_markup')) {
        fallbackSqliteDb.run("INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, ?)", ['default_percentage_markup', '20', now]);
      }
    } catch (e: any) {
      logger.warn(`Failed seeding baseline settings: ${e.message}`);
    }

    this.persistFallback();
  }

  private persistFallback() {
    if (!fallbackSqliteDb) return;
    try {
      const data = fallbackSqliteDb.export();
      const buffer = Buffer.from(data);
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, buffer);
      fs.renameSync(tmp, DB_FILE);
    } catch (err: any) {
      logger.error('Failed to persist fallback database', { error: err.message });
    }
  }

  async getHealth(): Promise<DatabaseHealth> {
    await this.initialize();

    if (activeProvider === 'postgresql') {
      const pool = getPostgresPool();
      const test = await testPostgresConnection();
      return {
        provider: 'postgresql',
        connected: test.connected,
        active_pool_clients: pool.totalCount - pool.idleCount,
        idle_pool_clients: pool.idleCount,
        total_pool_clients: pool.totalCount,
        version: test.version,
        error: test.error
      };
    }

    return {
      provider: 'sqlite_fallback',
      connected: fallbackSqliteDb !== null,
      version: 'SQLite 3 (WASM Portability Engine)'
    };
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.initialize();

    if (activeProvider === 'postgresql') {
      const pool = getPostgresPool();
      const pgSql = toPgSql(sql);
      const result = await pool.query(pgSql, params);
      return result.rows as T[];
    }

    // Fallback SQLite
    if (!fallbackSqliteDb) throw new Error('Database not initialized');
    const stmt = fallbackSqliteDb.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return results;
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    await this.initialize();

    if (activeProvider === 'postgresql') {
      const pool = getPostgresPool();
      const pgSql = toPgSql(sql);
      await pool.query(pgSql, params);
      return;
    }

    if (!fallbackSqliteDb) throw new Error('Database not initialized');
    const stmt = fallbackSqliteDb.prepare(sql);
    stmt.run(params);
    stmt.free();
    this.persistFallback();
  }

  async transaction<T>(callback: (clientOrDb: any) => Promise<T>): Promise<T> {
    await this.initialize();

    if (activeProvider === 'postgresql') {
      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN;');
        const result = await callback(client);
        await client.query('COMMIT;');
        return result;
      } catch (err) {
        await client.query('ROLLBACK;');
        throw err;
      } finally {
        client.release();
      }
    }

    // Fallback
    fallbackSqliteDb!.run('BEGIN TRANSACTION;');
    try {
      const result = await callback(fallbackSqliteDb);
      fallbackSqliteDb!.run('COMMIT;');
      this.persistFallback();
      return result;
    } catch (e) {
      fallbackSqliteDb!.run('ROLLBACK;');
      throw e;
    }
  }

  async close(): Promise<void> {
    if (activeProvider === 'postgresql') {
      await closePostgresPool();
    } else if (fallbackSqliteDb) {
      this.persistFallback();
      fallbackSqliteDb.close();
      fallbackSqliteDb = null;
    }
    this.initialized = false;
  }
}

export const dbAdapter = new DatabaseAdapter();
