import { DiscoveryModule } from '@golevelup/nestjs-discovery'
import { DynamicModule, Global, Module } from '@nestjs/common'
import { PgLockService } from './services/pg-lock.service'
import {
  PG_PUBSUB_CONFIG,
  PG_PUBSUB_QUEUE_BATCH_SIZE,
  PG_PUBSUB_QUEUE_CLEANUP_INTERVAL,
  PG_PUBSUB_QUEUE_MAX_RETRIES,
  PG_PUBSUB_QUEUE_MESSAGE_TTL,
  PG_PUBSUB_QUEUE_SCHEMA,
  PG_PUBSUB_QUEUE_TABLE,
  PG_PUBSUB_TRIGGER_NAME,
  PG_PUBSUB_TRIGGER_SCHEMA,
  PgPubSubConfig,
} from './pg-pubsub'
import { PgPubSubService } from './pg-pubsub.service'
import { assertSafeIdentifier } from './pg-pubsub.utils'
import {
  ListenerDiscoveryService,
  MessageProcessorService,
  PgConnectionPoolService,
  PgTriggerService,
  QueueService,
} from './services'

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    PgPubSubService,
    PgLockService,
    PgConnectionPoolService,
    QueueService,
    ListenerDiscoveryService,
    MessageProcessorService,
    PgTriggerService,
  ],
  exports: [PgPubSubService, PgLockService, QueueService],
})
export class PgPubSubModule {
  static forRoot(config: PgPubSubConfig): DynamicModule {
    const triggerSchema = (config.triggerSchema || PG_PUBSUB_TRIGGER_SCHEMA).trim()
    const triggerPrefix = (config.triggerPrefix || PG_PUBSUB_TRIGGER_NAME).trim()
    const queueSchema = (config.queue?.schema || PG_PUBSUB_QUEUE_SCHEMA).trim()
    const queueTable = (config.queue?.table || PG_PUBSUB_QUEUE_TABLE).trim()

    // Validate identifiers to prevent SQL injection (defense-in-depth)
    assertSafeIdentifier(triggerSchema, 'triggerSchema')
    assertSafeIdentifier(triggerPrefix, 'triggerPrefix')
    assertSafeIdentifier(queueSchema, 'queue.schema')
    assertSafeIdentifier(queueTable, 'queue.table')

    return {
      module: PgPubSubModule,
      providers: [
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: {
            ...config,
            triggerSchema,
            triggerPrefix,
            queue: {
              schema: queueSchema,
              table: queueTable,
              maxRetries: PG_PUBSUB_QUEUE_MAX_RETRIES,
              messageTTL: PG_PUBSUB_QUEUE_MESSAGE_TTL,
              cleanupInterval: PG_PUBSUB_QUEUE_CLEANUP_INTERVAL,
              batchSize: PG_PUBSUB_QUEUE_BATCH_SIZE,
              ...config.queue,
            },
          } satisfies PgPubSubConfig,
        },
      ],
      exports: [PgPubSubService],
    }
  }
}
