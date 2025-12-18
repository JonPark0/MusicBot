import { Pool, QueryResult } from 'pg';
import { config } from '../config/constants';
import { logger } from '../utils/logger';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', err);
    });
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    try {
      const res = await this.pool.query(text, params);
      // Only log query details in debug mode to reduce overhead
      if (logger.isDebugEnabled && logger.isDebugEnabled()) {
        logger.debug('Executed query', { text, rows: res.rowCount });
      }
      return res;
    } catch (error) {
      logger.error('Database query error', { text, error });
      throw error;
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  async close() {
    await this.pool.end();
    logger.info('Database pool closed');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  }
}

export const db = new Database();
