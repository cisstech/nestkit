/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import createPostgresSubscriber, { Subscriber } from 'pg-listen'
import { Subscription, interval } from 'rxjs'
import { PG_PUBSUB_CONFIG, PgPubSubConfig } from './pg-pubsub'
import {
  ListenerDiscovery,
  ListenerDiscoveryService,
  MessageProcessorService,
  PgLockService,
  PgTriggerService,
  QueueService,
} from './services'

/**
 * Service responsible for subscribing to PostgreSQL pub/sub triggers and handling table changes.
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
    private readonly pgLockService: PgLockService,
    private readonly queueService: QueueService,
    private readonly triggerService: PgTriggerService,
    private readonly messageProcessorService: MessageProcessorService,
    private readonly listenerDiscoveryService: ListenerDiscoveryService
  ) {}

  async onModuleInit(): Promise<void> {
    this.discovery = await this.listenerDiscoveryService.discoverListeners()

    await this.pgLockService.tryLock({
      key: 'pg_pubsub',
      duration: 5_000,
      onAccept: async () => {
        await this.queueService.setup()
        await this.setupListenersAndTriggers()
      },
      onReject: () => this.logger.warn('Another instance is already updating PubSub triggers'),
    })

    await this.resume()
  }

  async onModuleDestroy(): Promise<void> {
    this.pollingSubscription?.unsubscribe()

    await this.queueService.teardown()
    await this.postgresSubscriber?.close()
  }

  /**
   * Pause the PostgreSQL listener.
   */
  async pause(): Promise<void> {
    this.pollingSubscription?.unsubscribe()
    this.pollingSubscription = undefined

    await this.postgresSubscriber?.close()
    this.postgresSubscriber = undefined

    this.logger.log('PostgreSQL listener paused')
  }

  /**
   * Resume the PostgreSQL listener.
   * This will connect to the database and start listening for changes.
   * It is automatically called when the module is initialized.
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
   * Suspend the PostgreSQL listener and run the provided action.
   * This is useful when you want to perform an action without being interrupted by the listener.
   * The listener will be resumed after the action is completed.
   * @param action The action to run while the listener is suspended.
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
   * @param channel The channel to subscribe to.
   * @param callback The callback to call when a notification is received.
   */
  async susbcribe<T>(channel: string, callback: (payload: T) => void): Promise<void> {
    await this.postgresSubscriber?.listenTo(channel)
    this.postgresSubscriber?.notifications.on(channel, callback)
  }

  /**
   * Set up listeners and triggers based on discovered providers
   */
  private async setupListenersAndTriggers(): Promise<void> {
    await this.triggerService.setupTriggers(this.discovery)
  }

  /**
   * Listen for changes on the PostgreSQL triggers.
   */
  private async listenForChanges(): Promise<void> {
    if (this.pollingSubscription) return

    this.logger.log(`Watching trigger for tables:\n${this.discovery.tableNames.join(',\n')}`)

    // Initial pull of any queued messages that might exist
    await this.messageProcessorService.pullAndProcessMessages(this.config.triggerPrefix!, this.discovery)

    // Subscribe to notifications and pull messages immediately when notified
    await this.susbcribe<number>(this.config.triggerPrefix!, async () => {
      await this.messageProcessorService.pullAndProcessMessages(this.config.triggerPrefix!, this.discovery)
    })

    // Fallback polling at a much lower frequency
    // to catch any messages that might have been missed due to notification failures
    const fallbackInterval = 60_000 // 60 seconds
    this.pollingSubscription = interval(fallbackInterval).subscribe(() => {
      this.messageProcessorService.pullAndProcessMessages(this.config.triggerPrefix!, this.discovery).catch((error) => {
        this.logger.error('Error during fallback message polling:', error)
      })
    })
  }
}
