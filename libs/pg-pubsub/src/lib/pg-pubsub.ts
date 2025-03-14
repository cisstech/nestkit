/* eslint-disable @typescript-eslint/no-explicit-any */
import { DiscoveredClassWithMeta } from '@golevelup/nestjs-discovery'
import { SetMetadata } from '@nestjs/common'
import { EntityTarget } from 'typeorm'
import { LockService } from './lock'

/**
 * Name of the PostgreSQL pubsub trigger.
 */
export const PG_PUBSUB_TRIGGER_NAME = 'pubsub_trigger'

/**
 * Type for a PostgreSQL table INSERT payload.
 */
export type PgTableInsertPayload<TRow = unknown> = {
  /** Unique identifier of the payload (used to prevents mulitple handling of the event) */
  id: string

  /** Type of the event */
  event: 'INSERT'

  /** Name of the table. */
  table: string

  /** Inserted row. */
  data: TRow
}

/**
 * Type for a PostgreSQL table DELETE payload.
 */
export type PgTableDeletePayload<TRow = unknown> = {
  /** Unique identifier of the payload (used to prevents mulitple handling of the event) */
  id: string

  /** Type of the event */
  event: 'DELETE'

  /** Name of the table. */
  table: string

  /** Deleted row */
  data: TRow
}

/**
 * Type for a PostgreSQL table UPDATE payload.
 */
export type PgTableUpdatePayload<TRow = unknown> = {
  /** Unique identifier of the payload (used to prevents mulitple handling of the event) */
  id: string

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
 * Type for a handler that listens to changes on a PostgreSQL table.
 */
export interface PgTableChangeListener<TRow> {
  /**
   * Process the batch of changes received for a PostgreSQL table.
   * @param changes The batch of changes for the table.
   */
  process(changes: PgTableChanges<TRow>): Promise<void>
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
   * Custom lock service to use
   * If not provided, an in-memory lock service will be used
   */
  lockService?: LockService
}

/**
 * Symbol for the configuration for the PostgreSQL pubsub module.
 */
export const PG_PUBSUB_CONFIG = Symbol('PG_PUBSUB_CONFIG')

/**
 * Symbol for the lock service used by the PostgreSQL pubsub module.
 */
export const PG_PUBSUB_LOCK_SERVICE = Symbol('PG_PUBSUB_LOCK_SERVICE')
