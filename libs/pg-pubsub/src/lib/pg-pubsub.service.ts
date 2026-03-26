/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import createPostgresSubscriber, { Subscriber } from 'pg-listen'
import { Subscription, interval } from 'rxjs'
import { DataSource, EntityManager } from 'typeorm'
import {
  ListenerDiscovery,
  PG_PUBSUB_CONFIG,
  PG_PUBSUB_FALLBACK_POLLING_INTERVAL,
  PG_PUBSUB_LOCK_DURATION,
  PgPubSubConfig,
  ResolvedListener,
} from './pg-pubsub'
import {
  ListenerDiscoveryService,
  MessageProcessorService,
  PgConnectionPoolService,
  PgLockService,
  PgTriggerService,
  QueueService,
} from './services'

/**
 * Subscribes to PostgreSQL pub/sub triggers and handles table changes.
 */
@Injectable()
export class PgPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgPubSubService.name)

  private discovery!: ListenerDiscovery
  private postgresSubscriber?: Subscriber
  private pollingSubscription?: Subscription

  constructor(
    @Inject(PG_PUBSUB_CONFIG)
    private readonly config: PgPubSubConfig,
    private readonly dataSource: DataSource,
    private readonly pgLockService: PgLockService,
    private readonly pgConnectionPoolService: PgConnectionPoolService,
    private readonly queueService: QueueService,
    private readonly triggerService: PgTriggerService,
    private readonly messageProcessorService: MessageProcessorService,
    private readonly listenerDiscoveryService: ListenerDiscoveryService
  ) {}

  async onModuleInit(): Promise<void> {
    this.discovery = await this.listenerDiscoveryService.discoverListeners()

    this.validateTransactionalListeners()

    await this.pgLockService.tryLock({
      key: 'pg_pubsub',
      duration: this.config.lockDuration ?? PG_PUBSUB_LOCK_DURATION,
      onAccept: async () => {
        await this.queueService.ensureQueueTable()
        await this.setupListenersAndTriggers()
      },
      onReject: () => this.logger.warn('Another instance is already updating PubSub triggers'),
    })

    await this.queueService.startWorker()
    await this.resume()
  }

  async onModuleDestroy(): Promise<void> {
    this.pollingSubscription?.unsubscribe()

    await this.queueService.stopWorker()
    await this.postgresSubscriber?.close()
  }

  /**
   * Pause the listener.
   */
  async pause(): Promise<void> {
    this.pollingSubscription?.unsubscribe()
    this.pollingSubscription = undefined

    await this.postgresSubscriber?.close()
    this.postgresSubscriber = undefined

    this.logger.log('PostgreSQL listener paused')
  }

  /**
   * Resume the listener.
   * Connects to the database and starts listening for changes.
   */
  async resume(): Promise<void> {
    return new Promise((resolve) => {
      // Build connection config with SSL support
      const connectionConfig = {
        connectionString: this.config.databaseUrl,
        ...(this.config.ssl && { ssl: this.config.ssl }),
      }

      this.postgresSubscriber =
        this.postgresSubscriber ??
        createPostgresSubscriber(connectionConfig, {
          retryInterval: (retryCount) => Math.min(1000 * 2 ** retryCount, 30000),
          retryTimeout: Number.POSITIVE_INFINITY,
        })

      this.postgresSubscriber.events.on('error', (error) => {
        this.logger.error(error)
      })

      this.postgresSubscriber.events.on('connected', async () => {
        this.logger.log('Connected to PostgreSQL')
        await this.listenForChanges()
        resolve()
      })

      this.postgresSubscriber.events.on('reconnect', (attempt) => {
        this.logger.log(`Reconnecting to PostgreSQL (attempt ${attempt})`)
      })

      this.postgresSubscriber.connect()
    })
  }

  /**
   * Pause the listener, run the provided action, then resume.
   */
  async suspendAndRun(action: () => Promise<void>): Promise<void> {
    await this.pause()
    try {
      await action()
    } finally {
      await this.resume()
    }
  }

  /**
   * Subscribe to a PostgreSQL pub/sub channel.
   */
  async susbcribe<T>(channel: string, callback: (payload: T) => void): Promise<void> {
    await this.postgresSubscriber?.listenTo(channel)
    this.postgresSubscriber?.notifications.on(channel, callback)
  }

  /**
   * Run a callback with pg-pubsub triggers disabled.
   *
   * Uses a session-scoped PostgreSQL variable (`pg_pubsub.disabled`) so that
   * triggers skip notification during the transaction. This is useful for
   * bulk operations (e.g., cascade deletes) where downstream notifications
   * would be meaningless or harmful.
   *
   * @example
   * ```typescript
   * await pgPubSubService.withTriggersDisabled(async (em) => {
   *   await em.getRepository(Customer).delete(customerId);
   * });
   * ```
   */
  async withTriggersDisabled<T>(callback: (entityManager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (entityManager) => {
      await entityManager.query("SET LOCAL pg_pubsub.disabled = 'true'")
      return callback(entityManager)
    })
  }

  /**
   * Run raw SQL queries with pg-pubsub triggers disabled.
   *
   * Uses the dedicated pg pool (independent of TypeORM). Useful when you
   * need to run bulk SQL without going through TypeORM entities.
   *
   * @example
   * ```typescript
   * await pgPubSubService.withTriggersDisabledRaw(async (query) => {
   *   await query('DELETE FROM orders WHERE customer_id = $1', [customerId]);
   *   await query('DELETE FROM customers WHERE id = $1', [customerId]);
   * });
   * ```
   */
  async withTriggersDisabledRaw<T>(
    callback: (query: <R = unknown>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>
  ): Promise<T> {
    const client = await this.pgConnectionPoolService.acquireClient()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL pg_pubsub.disabled = 'true'")

      const queryFn = async <R = unknown>(sql: string, params?: unknown[]): Promise<R[]> => {
        const result = await client.query(sql, params)
        return result.rows as R[]
      }

      const result = await callback(queryFn)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  private async setupListenersAndTriggers(): Promise<void> {
    await this.triggerService.setupTriggers(this.discovery)
  }

  private validateTransactionalListeners(): void {
    const hasTransactional = Object.values(this.discovery.listenersMap)
      .flat()
      .some((l: ResolvedListener) => l.transactional)

    if (hasTransactional && !this.config.transactionAdapter) {
      throw new Error(
        'pg-pubsub: transactional listeners detected but no transactionAdapter provided in config. ' +
          'Either remove transactional: true from your listeners or provide a transactionAdapter in PgPubSubModule.forRoot().'
      )
    }
  }

  private async listenForChanges(): Promise<void> {
    if (this.pollingSubscription) return

    this.logger.log(`Watching trigger for tables:\n${this.discovery.tableNames.join(',\n')}`)

    // Initial pull of any queued messages
    await this.messageProcessorService.pullAndProcessMessages(this.config.triggerPrefix!, this.discovery)

    // Subscribe to notifications and pull messages when notified
    await this.susbcribe<number>(this.config.triggerPrefix!, async () => {
      await this.messageProcessorService.pullAndProcessMessages(this.config.triggerPrefix!, this.discovery)
    })

    // Fallback polling to catch messages missed due to notification failures
    const fallbackInterval = this.config.fallbackPollingInterval ?? PG_PUBSUB_FALLBACK_POLLING_INTERVAL
    this.pollingSubscription = interval(fallbackInterval).subscribe(() => {
      this.messageProcessorService.pullAndProcessMessages(this.config.triggerPrefix!, this.discovery).catch((error) => {
        this.logger.error('Error during fallback message polling:', error)
      })
    })
  }
}
