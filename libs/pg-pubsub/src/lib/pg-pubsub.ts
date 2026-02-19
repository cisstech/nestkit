/* eslint-disable @typescript-eslint/no-explicit-any */
import { DiscoveredClassWithMeta } from '@golevelup/nestjs-discovery'
import { SetMetadata } from '@nestjs/common'
import { EntityTarget } from 'typeorm'

/**
 * Name of the PostgreSQL pubsub trigger channel and prefix for the triggers created.
 */
export const PG_PUBSUB_TRIGGER_NAME = 'pubsub_trigger'

/**
 * Schema on which the tables are located and triggers are created.
 */
export const PG_PUBSUB_TRIGGER_SCHEMA = 'public'

/**
 * Name of the PostgreSQL pubsub queue schema.
 */
export const PG_PUBSUB_QUEUE_SCHEMA = 'public'

/**
 * Name of the PostgreSQL pubsub queue table.
 */
export const PG_PUBSUB_QUEUE_TABLE = 'pg_pubsub_queue'

/**
 * Default ttl for messages in the queue (in milliseconds).
 * @default 24 hours
 */
export const PG_PUBSUB_QUEUE_MESSAGE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Maximum number of retries for a failed message.
 * @default 5
 */
export const PG_PUBSUB_QUEUE_MAX_RETRIES = 5

/**
 * Default interval to clean up old processed messages (in milliseconds).
 * @default 1 hour
 */
export const PG_PUBSUB_QUEUE_CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour

/**
 * Default batch size for fetching pending messages.
 * @default 100
 */
export const PG_PUBSUB_QUEUE_BATCH_SIZE = 100

/**
 * Type for a PostgreSQL table INSERT payload.
 */
export type PgTableInsertPayload<TRow = unknown> = {
  /** Unique identifier of the payload (pass it to the onError callback to mark the payload handling as failed and retry later) */
  id: number

  /** Type of the event */
  event: 'INSERT'

  /** Name of the table. */
  table: string

  /** Inserted row. */
  data: TRow

  /** Queue metadata */
  _metadata?: {
    /** Number of times this message has been retried */
    retry_count: number
    /** When the message was originally created */
    created_at: Date
  }
}

/**
 * Type for a PostgreSQL table DELETE payload.
 */
export type PgTableDeletePayload<TRow = unknown> = {
  /** Unique identifier of the payload (pass it to the onError callback to mark the payload handling as failed and retry later) */
  id: number

  /** Type of the event */
  event: 'DELETE'

  /** Name of the table. */
  table: string

  /** Deleted row */
  data: TRow

  /** Queue metadata */
  _metadata?: {
    /** Number of times this message has been retried */
    retry_count: number
    /** When the message was originally created */
    created_at: Date
  }
}

/**
 * Type for a PostgreSQL table UPDATE payload.
 */
export type PgTableUpdatePayload<TRow = unknown> = {
  /** Unique identifier of the payload (pass it to the onError callback to mark the payload handling as failed and retry later) */
  id: number

  /** Type of the event */
  event: 'UPDATE'

  /** Name of the table. */
  table: string

  /** Updated row. */
  data: {
    /** New value of the row. */
    new: TRow

    /** Old value of the row */
    old: TRow

    /** List of updated columns. (object fields are not currently supported)  */
    updatedFields: string[]
  }

  /** Queue metadata */
  _metadata?: {
    /** Number of times this message has been retried */
    retry_count: number
    /** When the message was originally created */
    created_at: Date
  }
}

/**
 * Type for a PostgreSQL table change payload.
 */
export type PgTableChangePayload<TRow = unknown> =
  | PgTableInsertPayload<TRow>
  | PgTableDeletePayload<TRow>
  | PgTableUpdatePayload<TRow>

/**
 * Type for a PostgreSQL table change type.
 */
export type PgTableChangeType = PgTableChangePayload['event']

/**
 * Type for a batch of changes received for a PostgreSQL table.
 */
export type PgTableChanges<TRow = unknown> = {
  /** List of all changes */
  all: PgTableChangePayload<TRow>[]

  /** List of update changes */
  UPDATE: PgTableUpdatePayload<TRow>[]

  /** List of insert changes */
  INSERT: PgTableInsertPayload<TRow>[]

  /** List of delete changes */
  DELETE: PgTableDeletePayload<TRow>[]
}

/**
 * Type for a callback to handle errors when processing a change.
 * @remarks
 * - Used to mark the message as failed and retry later.
 * @param id The id of the messages that failed.
 */
export type PgTableChangeErrorHandler = (ids: number[]) => void

/**
 * Type for a handler that listens to changes on a PostgreSQL table.
 */
export interface PgTableChangeListener<TRow> {
  /**
   * Process the batch of changes received for a PostgreSQL table.
   * @param changes The batch of changes for the table.
   * @param onError Callback to handle errors when processing a change. (used to mark the message as failed and retry later)
   */
  process(changes: PgTableChanges<TRow>, onError?: PgTableChangeErrorHandler): Promise<void>
}

/**
 * Type representing a class discovered with metadata `@RegisterPgTableChangeListener`
 * for a PostgreSQL table change listener.
 */
export type DiscoveredPgTableChangeListener = DiscoveredClassWithMeta<RegisterPgTableChangeListenerMetadata>

/**
 * Symbol for the metadata key used to register a PostgreSQL table change listener.
 */
export const RegisterPgTableChangeListenerMeta = Symbol('RegisterPgTableChangeListenerMeta')

export type RegisterPgTableChangeListenerMetadata<T = any> = {
  /**
   * Entity type to listen for changes.
   */
  target: EntityTarget<T>

  /**
   * Schema on which the table is located. (default: {@link PG_PUBSUB_TRIGGER_SCHEMA})
   */
  schema?: string

  /**
   * List of events to listen for.
   * @remarks
   * - If not provided, all events will be listened for.
   * - If multiple listeners are registered for the same table, the values of this field will be merged.
   */
  events?: PgTableChangeType[]

  /**
   * List of fields to include in the payload of PG_NOTIFY.
   * @remarks
   * - If not provided, all fields will be included.
   * - If multiple listeners are registered for the same table, the values of this field will be merged.
   */
  payloadFields?: (keyof T)[]
}

/**
 * Decorator used to register a PostgreSQL table change listener.
 * @param target The target EntityTarget for the listener.
 */
export const RegisterPgTableChangeListener = <T = any>(
  target: EntityTarget<T>,
  params?: Omit<RegisterPgTableChangeListenerMetadata, 'target'>
) =>
  SetMetadata(RegisterPgTableChangeListenerMeta, {
    target,
    ...params,
  })

/**
 * Configuration for the PostgreSQL pubsub module.
 */
export type PgPubSubConfig = {
  /**
   * Database URL to connect to.
   */
  databaseUrl: string

  /**
   * SSL configuration for the database connection.
   * Passed directly to pg-listen/node-postgres.
   */
  ssl?: any

  /**
   * Schema on which the tables are located.
   * If not provided, the default {@link PG_PUBSUB_TRIGGER_SCHEMA} will be used.

   */
  triggerSchema?: string

  /**
   * Prefix to use for the triggers.
   * If not provided, the default {@link PG_PUBSUB_TRIGGER_NAME} prefix will be used.
   * @remarks
   * - The trigger name will be in the format `${triggerPrefix}_${table_name}`.
   * - This value will also be used as the channel name for the pubsub.
   * - **IMPORTANT**: All triggers starting with the same prefix will be dropped when the module is initialized.
   */
  triggerPrefix?: string

  /**
   * Queue configuration
   */
  queue?: QueueConfig

  /**
   * Dedicated PG pool configuration.
   * This pool is independent of TypeORM's connection pool, ensuring that
   * pg-pubsub operations are never blocked by TypeORM pool exhaustion.
   */
  pool?: PoolConfig

  /**
   * Custom lock service to use
   * If not provided, an in-memory lock service will be used
   * @deprecated Will be removed in future versions
   */
  lockService?: any
}

/**
 * Status of a queued message
 */
export enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

/**
 * Representation of a message in the queue
 */
export interface QueuedMessage<T = unknown> {
  id: number
  channel: string
  payload: T
  created_at: Date
  processed_at: Date | null
  retry_count: number
  next_retry_at: Date | null
  status: MessageStatus
}

/**
 * Queue processing configuration
 */
export interface QueueConfig {
  /**
   * Name of the queue schema
   * @default PG_PUBSUB_QUEUE_SCHEMA
   */
  schema?: string

  /**
   * Name of the queue table
   * @default PG_PUBSUB_QUEUE_TABLE
   */
  table?: string

  /**
   * Maximum number of retries for a failed message
   * @default PG_PUBSUB_QUEUE_MAX_RETRIES
   */
  maxRetries?: number

  /**
   * Time-to-live for messages in milliseconds
   * @default PG_PUBSUB_QUEUE_MESSAGE_TTL
   */
  messageTTL?: number

  /**
   * Interval in milliseconds to clean up old processed messages
   * @default PG_PUBSUB_QUEUE_CLEANUP_INTERVAL
   */
  cleanupInterval?: number

  /**
   * Maximum number of messages to fetch per pull cycle.
   * @default 100
   */
  batchSize?: number
}

/**
 * Configuration for the dedicated PG connection pool.
 */
export interface PoolConfig {
  /**
   * Maximum number of connections in the dedicated pool.
   * @default 2
   */
  max?: number
}

/**
 * Symbol for the configuration for the PostgreSQL pubsub module.
 */
export const PG_PUBSUB_CONFIG = Symbol('PG_PUBSUB_CONFIG')
