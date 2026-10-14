import { dbAdapter, DatabaseHealth } from '../adapters/database.adapter.js';

export const dbService = {
  async getHealth(): Promise<DatabaseHealth> {
    return await dbAdapter.getHealth();
  },

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return await dbAdapter.query<T>(sql, params);
  },

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return await dbAdapter.queryOne<T>(sql, params);
  },

  async run(sql: string, params: any[] = []): Promise<void> {
    return await dbAdapter.run(sql, params);
  },

  async transaction<T>(callback: (clientOrDb: any) => Promise<T>): Promise<T> {
    return await dbAdapter.transaction<T>(callback);
  },

  async close(): Promise<void> {
    return await dbAdapter.close();
  }
};

export function persistDb(): void {
  // Persistence is handled automatically inside the adapter
}
