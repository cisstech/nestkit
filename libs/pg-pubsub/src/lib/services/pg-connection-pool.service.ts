import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Pool, PoolClient, PoolConfig } from 'pg'
import { PG_PUBSUB_CONFIG, PgPubSubConfig } from '../pg-pubsub'

/**
 * A dedicated PostgreSQL connection pool for pg-pubsub operations.
 *
 * This pool is independent of TypeORM's connection pool, ensuring that
 * pg-pubsub operations (queue management, trigger setup, advisory locks)
 * are never blocked by TypeORM pool exhaustion.
 */
@Injectable()
export class PgConnectionPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgConnectionPoolService.name)
  private pool!: Pool

  constructor(
    @Inject(PG_PUBSUB_CONFIG)
    private readonly config: PgPubSubConfig
  ) {}

  async onModuleInit(): Promise<void> {
    const poolConfig: PoolConfig = {
      connectionString: this.config.databaseUrl,
      max: this.config.pool?.max ?? 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ...(this.config.ssl && { ssl: this.config.ssl }),
    }

    this.pool = new Pool(poolConfig)

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err)
    })

    // Warm up the pool with a single connection test
    try {
      const client = await this.pool.connect()
      client.release()
      this.logger.log(`Dedicated PG pool initialized (max: ${poolConfig.max})`)
    } catch (err) {
      this.logger.error('Failed to initialize dedicated PG pool', err)
      throw err
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.pool.end()
      this.logger.log('Dedicated PG pool closed')
    } catch (err) {
      this.logger.error('Error closing dedicated PG pool', err)
    }
  }

  /**
   * Execute a query using the pool, automatically acquiring and releasing a client.
   * @param sql The SQL query to execute.
   * @param params Optional query parameters.
   * @returns The result rows.
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params)
    return result.rows as T[]
  }

  /**
   * Acquire a dedicated client from the pool.
   *
   * **Important:** The caller is responsible for releasing the client via `client.release()`.
   * This is necessary for operations that require session-scoped behavior (e.g., advisory locks).
   */
  async acquireClient(): Promise<PoolClient> {
    return this.pool.connect()
  }
}
