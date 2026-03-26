import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Pool, PoolClient, PoolConfig } from 'pg'
import { PG_PUBSUB_CONFIG, PG_PUBSUB_POOL_MAX, PgPubSubConfig } from '../pg-pubsub'

/**
 * Dedicated PostgreSQL connection pool for pg-pubsub operations,
 * independent of TypeORM's connection pool.
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
    const maxPoolSize = this.config.pool?.max ?? PG_PUBSUB_POOL_MAX
    if (!Number.isInteger(maxPoolSize) || maxPoolSize < 1) {
      throw new Error(`Invalid pg-pubsub pool.max value: ${maxPoolSize}. Must be a positive integer.`)
    }

    const poolConfig: PoolConfig = {
      connectionString: this.config.databaseUrl,
      max: maxPoolSize,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ...(this.config.ssl && { ssl: this.config.ssl }),
    }

    this.pool = new Pool(poolConfig)

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err)
    })

    // Warm up with a single connection test
    try {
      const client = await this.pool.connect()
      client.release()
      this.logger.log(`Dedicated PG pool initialized (max: ${poolConfig.max})`)
    } catch (err) {
      this.logger.error('Failed to initialize dedicated PG pool', err)
      await this.pool.end().catch(() => {
        // Ignore errors during pool shutdown
      })
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
   * Execute a query using the pool.
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params)
    return result.rows as T[]
  }

  /**
   * Acquire a dedicated client from the pool.
   * The caller is responsible for releasing the client via `client.release()`.
   */
  async acquireClient(): Promise<PoolClient> {
    return this.pool.connect()
  }
}
