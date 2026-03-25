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
  PG_PUBSUB_QUEUE_PROCESSING_TIMEOUT,
  PG_PUBSUB_QUEUE_SCHEMA,
  PG_PUBSUB_QUEUE_TABLE,
  PgPubSubConfig,
  QueuedMessage,
} from '../pg-pubsub'
import { PgConnectionPoolService } from './pg-connection-pool.service'

@Injectable()
export class QueueService {
  private cleanupSubscription?: Subscription
  private readonly logger = new Logger(QueueService.name)
  private readonly queueSchema: string
  private readonly queueTable: string
  private readonly maxRetries: number
  private readonly messageTTL: number
  private readonly batchSize: number
  private readonly cleanupInterval: number
  private readonly processingTimeout: number

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
    this.processingTimeout = config.queue?.processingTimeout ?? PG_PUBSUB_QUEUE_PROCESSING_TIMEOUT
  }

  async ensureQueueTable(): Promise<void> {
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

  async startWorker(): Promise<void> {
    await this.recoverOrphanedMessages()
    await this.cleanupOldMessages()
    this.startPeriodicCleanup()
  }

  async stopWorker(): Promise<void> {
    if (this.cleanupSubscription) {
      this.cleanupSubscription.unsubscribe()
    }
  }

  async fetchPendingMessages<T>(channel: string): Promise<QueuedMessage<T>[]> {
    try {
      const messages = await this.pgPool.query<QueuedMessage<T>>(
        `
        UPDATE "${this.queueSchema}"."${this.queueTable}"
        SET status = '${MessageStatus.PROCESSING}',
            next_retry_at = NOW() + ($4 || ' milliseconds')::interval
        WHERE id IN (
          SELECT id FROM "${this.queueSchema}"."${this.queueTable}"
          WHERE (status = '${MessageStatus.PENDING}' OR
                (status = '${MessageStatus.FAILED}' AND
                 retry_count < $1 AND
                 next_retry_at <= NOW()))
            AND channel = $2
          ORDER BY id ASC
          LIMIT $3
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `,
        [this.maxRetries, channel, this.batchSize, this.processingTimeout]
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
              ELSE NOW() + (interval '1 minute' * (2 ^ retry_count))
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

  private startPeriodicCleanup(): void {
    this.cleanupSubscription = interval(this.cleanupInterval).subscribe(() => {
      this.cleanupOldMessages().catch((err) => {
        this.logger.error('Failed to clean up old messages', err)
      })
    })
  }

  private async cleanupOldMessages(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.messageTTL)
    let totalCleaned = 0

    try {
      let deleted: { id: number }[]
      do {
        deleted = await this.pgPool.query<{ id: number }>(
          `
        DELETE FROM "${this.queueSchema}"."${this.queueTable}"
        WHERE id IN (
          SELECT id FROM "${this.queueSchema}"."${this.queueTable}"
          WHERE (status = '${MessageStatus.PROCESSED}' AND processed_at < $1)
            OR (created_at < $1 AND status = '${MessageStatus.FAILED}' AND retry_count >= $2)
            OR (created_at < $1 AND status = '${MessageStatus.PROCESSING}')
          LIMIT 1000
        )
        RETURNING id
      `,
          [cutoffDate, this.maxRetries]
        )
        totalCleaned += deleted?.length ?? 0
      } while (deleted?.length === 1000)

      if (totalCleaned > 0) {
        this.logger.log(`Cleaned up ${totalCleaned} old messages`)
      }
    } catch (error: any) {
      this.logger.error(`Failed to clean up old messages: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * Reset orphaned messages (stuck in 'processing' due to instance crash) back to 'pending'
   * so they can be retried. Only recovers messages whose next_retry_at has passed,
   * to avoid resetting messages actively being processed by another instance.
   */
  private async recoverOrphanedMessages(): Promise<void> {
    try {
      const result = await this.pgPool.query(
        `
        UPDATE "${this.queueSchema}"."${this.queueTable}"
        SET status = '${MessageStatus.PENDING}',
            next_retry_at = NULL
        WHERE status = '${MessageStatus.PROCESSING}'
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        RETURNING id
      `
      )

      if (result?.length) {
        this.logger.log(`Recovered ${result.length} orphaned messages back to pending`)
      }
    } catch (error: any) {
      this.logger.error(`Failed to recover orphaned messages: ${error.message}`, error.stack)
      throw error
    }
  }
}
