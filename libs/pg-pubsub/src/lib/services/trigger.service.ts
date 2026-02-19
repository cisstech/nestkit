import { Inject, Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import {
  PG_PUBSUB_CONFIG,
  PG_PUBSUB_QUEUE_SCHEMA,
  PG_PUBSUB_QUEUE_TABLE,
  PgPubSubConfig,
  PgTableChangeType,
} from '../pg-pubsub'
import { ListenerDiscovery } from './listener-discovery.service'
import { PgConnectionPoolService } from './pg-connection-pool.service'

const HASH_PREFIX = 'pg-pubsub:hash='

export interface TriggerMetadata {
  name: string
  table: string
  schema: string
  events?: PgTableChangeType[]
  payloadFields?: string[]
  /** Hash stored in the COMMENT ON FUNCTION, if any */
  hash?: string
}

export interface TableListener {
  events?: PgTableChangeType[]
  table: string
  schema: string
  payloadFields?: string[]
}

@Injectable()
export class PgTriggerService {
  private readonly logger = new Logger(PgTriggerService.name)

  constructor(
    private readonly pgPool: PgConnectionPoolService,
    @Inject(PG_PUBSUB_CONFIG) private readonly config: PgPubSubConfig
  ) {}

  /**
   * Setup triggers for the given listener discovery result using differential update.
   * Uses MD5 hashes stored in COMMENT ON FUNCTION to skip recreating unchanged triggers.
   * Only obsolete triggers are dropped, and new/changed triggers are upserted.
   * @param discovery The listener discovery result.
   */
  async setupTriggers(discovery: ListenerDiscovery): Promise<void> {
    const existingTriggers = await this.listTriggers()

    // Map of desired triggers: key = "schema.table", value = trigger metadata
    const desiredTriggersMap = new Map<string, TriggerMetadata>()
    discovery.listeners.forEach((listener) => {
      const key = `${listener.schema}.${listener.table}`
      desiredTriggersMap.set(key, {
        table: listener.table,
        schema: listener.schema,
        name: `${this.config.triggerPrefix}_${listener.table.toLowerCase()}`,
        events: listener.events,
        payloadFields: listener.payloadFields,
      })
    })

    // Map of existing triggers: key = "schema.table"
    const existingTriggersMap = new Map<string, TriggerMetadata>()
    existingTriggers.forEach((trigger) => {
      const key = `${trigger.schema}.${trigger.table}`
      existingTriggersMap.set(key, trigger)
    })

    // Calculate diff: B - A (triggers to drop - obsolete ones)
    const triggersToRemove: TriggerMetadata[] = []
    existingTriggersMap.forEach((trigger, key) => {
      if (!desiredTriggersMap.has(key)) {
        triggersToRemove.push(trigger)
      }
    })

    // Calculate triggers to upsert only if hash differs from existing
    const triggersToUpsert: TriggerMetadata[] = []
    desiredTriggersMap.forEach((desired, key) => {
      const existing = existingTriggersMap.get(key)
      const desiredHash = this.computeTriggerHash(desired, discovery.propNameToColumnNames)

      if (!existing || existing.hash !== desiredHash) {
        triggersToUpsert.push(desired)
      } else {
        this.logger.debug(`Trigger ${desired.schema}.${desired.name} unchanged (hash match), skipping`)
      }
    })

    // First, upsert changed triggers (atomic per trigger using CREATE OR REPLACE)
    // This ensures triggers are always active, preventing event loss
    if (triggersToUpsert.length > 0) {
      await this.createTriggers(triggersToUpsert, discovery.propNameToColumnNames)
    } else if (desiredTriggersMap.size > 0) {
      this.logger.log('All triggers are up-to-date, no DDL needed')
    }

    // Then, drop obsolete triggers (safe now since new ones are active)
    if (triggersToRemove.length > 0) {
      await this.dropTriggers(triggersToRemove)
    }
  }

  /**
   * Compute a deterministic MD5 hash for a trigger configuration.
   * The hash captures: events, payloadFields, schema, table, triggerPrefix, queueSchema, queueTable.
   */
  computeTriggerHash(trigger: TriggerMetadata, propNameToColumnNames: Record<string, Map<string, string>>): string {
    const events = trigger.events?.length ? [...trigger.events].sort() : ['DELETE', 'INSERT', 'UPDATE']
    const columns = propNameToColumnNames[trigger.table]
    const resolvedPayloadFields = trigger.payloadFields?.length
      ? trigger.payloadFields.map((field) => columns?.get(field) ?? field).sort()
      : []

    const hashInput = JSON.stringify({
      events,
      payloadFields: resolvedPayloadFields,
      schema: trigger.schema,
      table: trigger.table,
      triggerPrefix: this.config.triggerPrefix,
      queueSchema: this.config.queue?.schema ?? PG_PUBSUB_QUEUE_SCHEMA,
      queueTable: this.config.queue?.table ?? PG_PUBSUB_QUEUE_TABLE,
    })

    return createHash('md5').update(hashInput).digest('hex')
  }

  private async listTriggers(): Promise<TriggerMetadata[]> {
    const triggers = await this.pgPool.query<{
      name: string
      schema: string
      table: string
      comment: string | null
    }>(`
      SELECT
        DISTINCT ON (t.trigger_name, t.trigger_schema, t.event_object_table)
        t.trigger_name as name,
        t.trigger_schema as schema,
        t.event_object_table as table,
        obj_description(p.oid, 'pg_proc') as comment
      FROM information_schema.triggers t
      LEFT JOIN pg_catalog.pg_proc p ON p.proname = t.trigger_name
      WHERE t.trigger_name LIKE '${this.config.triggerPrefix}_%'
    `)

    return (triggers ?? []).map((t) => ({
      name: t.name,
      schema: t.schema,
      table: t.table,
      hash: t.comment?.startsWith(HASH_PREFIX) ? t.comment.slice(HASH_PREFIX.length) : undefined,
    }))
  }

  private async dropTriggers(triggers: TriggerMetadata[]): Promise<void> {
    if (!triggers.length) return

    this.logger.log(`Dropping triggers:\n${triggers.map((t) => `${t.schema}.${t.table}.${t.name}`).join(',\n')}`)
    await this.pgPool.query(triggers.map((t) => `DROP FUNCTION IF EXISTS ${t.schema}."${t.name}" CASCADE`).join('; '))
  }

  private async createTriggers(
    triggers: TriggerMetadata[],
    propNameToColumnNames: Record<string, Map<string, string>>
  ): Promise<void> {
    if (!triggers.length) return

    this.logger.log(`Upserting triggers:\n${triggers.map((t) => `${t.schema}.${t.table}.${t.name}`).join(',\n')}`)

    await Promise.all(
      triggers.map(async (t) => {
        const table = `"${t.schema}"."${t.table}"`
        const payloadFields = t.payloadFields
        const columns = propNameToColumnNames[t.table]

        const buildJson = (alias: string) => {
          if (!payloadFields?.length) {
            return `row_to_json(${alias})`
          }

          const selects = payloadFields
            .map((field) => `'${columns.get(field)}', ${alias}."${columns.get(field)}"`)
            .join(', ')

          return `json_build_object(${selects})`
        }

        const events = t.events?.length ? t.events : ['INSERT', 'UPDATE', 'DELETE']
        const hash = this.computeTriggerHash(t, propNameToColumnNames)

        await this.pgPool.query(`
          -- Create the trigger function
          CREATE OR REPLACE FUNCTION ${t.schema}."${t.name}"()
          RETURNS TRIGGER
          AS $BODY$
          DECLARE
            payload JSON;
            inserted_id INTEGER;
          BEGIN
            IF (TG_OP = 'DELETE') THEN
              payload := json_build_object(
                'id', gen_random_uuid(),
                'event', TG_OP,
                'schema', TG_TABLE_SCHEMA,
                'table', TG_TABLE_NAME,
                'data', ${buildJson('OLD')}
              );
            ELSIF (TG_OP = 'UPDATE') THEN
              payload := json_build_object(
                'id', gen_random_uuid(),
                'event', TG_OP,
                'schema', TG_TABLE_SCHEMA,
                'table', TG_TABLE_NAME,
                'data', json_build_object(
                  'new', ${buildJson('NEW')},
                  'old', ${buildJson('OLD')}
                )
              );
            ELSE
              payload := json_build_object(
                'id', gen_random_uuid(),
                'event', TG_OP,
                'schema', TG_TABLE_SCHEMA,
                'table', TG_TABLE_NAME,
                'data', ${buildJson('NEW')}
              );
            END IF;

            -- Insert into queue table and get the inserted ID
            INSERT INTO "${this.config.queue?.schema ?? PG_PUBSUB_QUEUE_SCHEMA}"."${
              this.config.queue?.table ?? PG_PUBSUB_QUEUE_TABLE
            }"(channel, payload)
            VALUES ('${this.config.triggerPrefix}', payload)
            RETURNING id INTO inserted_id;

            -- Send notification with just the message ID
            PERFORM pg_notify('${this.config.triggerPrefix}', inserted_id::text);

            RETURN NEW;
          END;
          $BODY$
          LANGUAGE plpgsql;

          -- Store config hash in a comment for change detection
          COMMENT ON FUNCTION ${t.schema}."${t.name}"() IS '${HASH_PREFIX}${hash}';

          -- Drop the trigger if it already exists
          DROP TRIGGER IF EXISTS ${t.name} ON ${table};

          -- Create the trigger
          CREATE TRIGGER ${t.name}
          AFTER ${events.join(' OR ')} ON ${table}
          FOR EACH ROW EXECUTE FUNCTION ${t.schema}."${t.name}"();
        `)
      })
    )
  }
}
