import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPostgresConfig(): pg.PoolConfig {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    const isSsl = process.env.PGSSL === 'true' || connectionString.includes('sslmode=require') || connectionString.includes('supabase') || connectionString.includes('neon.tech');
    return {
      connectionString,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PGMAX_POOL || 20),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    };
  }

  return {
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'toolpadi',
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGMAX_POOL || 20),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  };
}

export function getPostgresPool(): pg.Pool {
  if (pool) return pool;

  const config = getPostgresConfig();
  pool = new Pool(config);

  pool.on('error', (err: Error) => {
    logger.error('Unexpected error on idle PostgreSQL client pool', { error: err.message });
  });

  return pool;
}

export async function testPostgresConnection(): Promise<{ connected: boolean; version?: string; error?: string }> {
  const p = getPostgresPool();
  try {
    const client = await p.connect();
    const res = await client.query('SELECT version();');
    client.release();
    return {
      connected: true,
      version: res.rows[0]?.version
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message
    };
  }
}

export async function closePostgresPool(): Promise<void> {
  if (pool) {
    logger.info('Closing PostgreSQL client connection pool...');
    await pool.end();
    pool = null;
  }
}
