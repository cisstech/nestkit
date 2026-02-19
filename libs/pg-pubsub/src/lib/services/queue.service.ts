/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inject, Injectable, Logger } from '@nestjs/common'
import { interval, Subscription } from 'rxjs'
import {
  MessageStatus,
  PG_PUBSUB_CONFIG,
  PG_PUBSUB_QUEUE_BATCH_SIZE,
  PG_PUBSUB_QUEUE_CLEANUP_INTERVAL,
  PG_PUBSUB_QUEUE_MAX_RETRIES,
  PG_PUBSUB_QUEUE_MESSAGE_TTL,
  PG_PUBSUB_QUEUE_SCHEMA,
  PG_PUBSUB_QUEUE_TABLE,
  PgPubSubConfig,
  QueuedMessage,
} from '../pg-pubsub'
import { PgConnectionPoolService } from './pg-connection-pool.service'

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name)
  private cleanupSubscription?: Subscription
  private readonly queueSchema: string
  private readonly queueTable: string
  private readonly maxRetries: number
  private readonly messageTTL: number
  private readonly cleanupInterval: number
  private readonly batchSize: number

  constructor(
    private readonly pgPool: PgConnectionPoolService,
    @Inject(PG_PUBSUB_CONFIG) config: PgPubSubConfig
  ) {
    this.queueSchema = config.queue?.schema ?? PG_PUBSUB_QUEUE_SCHEMA
    this.queueTable = config.queue?.table ?? PG_PUBSUB_QUEUE_TABLE
    this.maxRetries = config.queue?.maxRetries ?? PG_PUBSUB_QUEUE_MAX_RETRIES
    this.messageTTL = config.queue?.messageTTL ?? PG_PUBSUB_QUEUE_MESSAGE_TTL
    this.cleanupInterval = config.queue?.cleanupInterval ?? PG_PUBSUB_QUEUE_CLEANUP_INTERVAL
    this.batchSize = config.queue?.batchSize ?? PG_PUBSUB_QUEUE_BATCH_SIZE
  }

  async setup(): Promise<void> {
    await this.createQueueTable()
    this.startCleanup()
  }

  async teardown(): Promise<void> {
    if (this.cleanupSubscription) {
      this.cleanupSubscription.unsubscribe()
    }
  }

  async fetchPendingMessages<T>(channel: string): Promise<QueuedMessage<T>[]> {
    try {
      // Get pending messages with FOR UPDATE SKIP LOCKED to prevent other processes from getting the same messages
      const messages = await this.pgPool.query<QueuedMessage<T>>(
        `
        UPDATE "${this.queueSchema}"."${this.queueTable}"
        SET status = '${MessageStatus.PROCESSING}',
            next_retry_at = NOW() + interval '5 minutes'
        WHERE id IN (
          SELECT id FROM "${this.queueSchema}"."${this.queueTable}"
          WHERE (status = '${MessageStatus.PENDING}' OR
                (status = '${MessageStatus.FAILED}' AND
                 retry_count < $1 AND
                 next_retry_at <= NOW()))
            AND channel = $2
          ORDER BY id ASC  -- Ensure order is preserved
          LIMIT ${this.batchSize}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `,
        [this.maxRetries, channel]
      )

      return messages || []
    } catch (error) {
      this.logger.error(`Failed to fetch pending messages:`, error)
      throw error
    }
  }

  async markAsProcessed(messageIds: number[]): Promise<void> {
    try {
      await this.pgPool.query(
        `
        UPDATE "${this.queueSchema}"."${this.queueTable}"
        SET status = '${MessageStatus.PROCESSED}',
            processed_at = NOW()
        WHERE id = ANY($1)
      `,
        [messageIds]
      )
    } catch (error) {
      this.logger.error(`Failed to mark message ${JSON.stringify(messageIds)} as processed:`, error)
      throw error
    }
  }

  async markAsFailed(messageIds: number[]): Promise<void> {
    try {
      await this.pgPool.query(
        `
        UPDATE "${this.queueSchema}"."${this.queueTable}"
        SET status = '${MessageStatus.FAILED}',
            retry_count = retry_count + 1,
            next_retry_at = CASE
              WHEN retry_count >= $1 THEN NULL
              ELSE NOW() + (interval '1 minute' * (2 ^ retry_count))  -- Exponential backoff
            END
        WHERE id = ANY($2)
      `,
        [this.maxRetries, messageIds]
      )
    } catch (error) {
      this.logger.error(`Failed to mark message ${JSON.stringify(messageIds)} as failed: `, error)
      throw error
    }
  }

  private async createQueueTable(): Promise<void> {
    try {
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS "${this.queueSchema}"."${this.queueTable}" (
          id BIGSERIAL PRIMARY KEY,
          channel VARCHAR(255) NOT NULL,
          payload JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP DEFAULT NULL,
          retry_count INT DEFAULT 0,
          next_retry_at TIMESTAMP DEFAULT NULL,
          status VARCHAR(20) DEFAULT '${MessageStatus.PENDING}'
        );

        CREATE INDEX IF NOT EXISTS "${this.queueTable}_status_idx"
          ON "${this.queueSchema}"."${this.queueTable}"(status);
        CREATE INDEX IF NOT EXISTS "${this.queueTable}_channel_idx"
          ON "${this.queueSchema}"."${this.queueTable}"(channel);
        CREATE INDEX IF NOT EXISTS "${this.queueTable}_next_retry_idx"
          ON "${this.queueSchema}"."${this.queueTable}"(next_retry_at);
      `)
      this.logger.log(`Queue table "${this.queueSchema}"."${this.queueTable}" created or already exists`)
    } catch (error: any) {
      this.logger.error(`Failed to create queue table: ${error.message}`, error.stack)
      throw error
    }
  }

  private startCleanup(): void {
    this.cleanupSubscription = interval(this.cleanupInterval).subscribe(() => {
      this.cleanupOldMessages().catch((err) => {
        this.logger.error('Failed to clean up old messages', err)
      })
    })
  }

  private async cleanupOldMessages(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.messageTTL)

    try {
      const result = await this.pgPool.query(
        `
        DELETE FROM "${this.queueSchema}"."${this.queueTable}"
        WHERE (status = '${MessageStatus.PROCESSED}' AND processed_at < $1)
          OR (created_at < $1 AND status = '${MessageStatus.FAILED}' AND retry_count >= $2)
        RETURNING id
      `,
        [cutoffDate, this.maxRetries]
      )

      if (result?.length) {
        this.logger.log(`Cleaned up ${result.length} old messages`)
      }
    } catch (error: any) {
      this.logger.error(`Failed to clean up old messages: ${error.message}`, error.stack)
      throw error
    }
  }
}
