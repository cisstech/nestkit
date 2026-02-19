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

export interface TriggerMetadata {
  name: string
  table: string
  schema: string
  events?: PgTableChangeType[]
  payloadFields?: string[]
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
  private readonly metaSchema: string
  private readonly metaTable = 'pg_pubsub_trigger_meta'

  constructor(
    private readonly pgPool: PgConnectionPoolService,
    @Inject(PG_PUBSUB_CONFIG) private readonly config: PgPubSubConfig
  ) {
    this.metaSchema = config.queue?.schema ?? PG_PUBSUB_QUEUE_SCHEMA
  }

  /**
   * Setup triggers using differential update.
   * Compares MD5 hashes stored in a metadata table to skip unchanged triggers.
   */
  async setupTriggers(discovery: ListenerDiscovery): Promise<void> {
    await this.ensureMetaTable()

    const storedHashes = await this.loadStoredHashes()
    const existingTriggers = await this.listTriggers()

    const desiredMap = new Map<string, TriggerMetadata>()
    discovery.listeners.forEach((listener) => {
      const name = `${this.config.triggerPrefix}_${listener.table.toLowerCase()}`
      desiredMap.set(name, {
        table: listener.table,
        schema: listener.schema,
        name,
        events: listener.events,
        payloadFields: listener.payloadFields,
      })
    })

    const existingSet = new Set(existingTriggers.map((t) => t.name))

    // Triggers to drop: exist in DB but not desired
    const toRemove = existingTriggers.filter((t) => !desiredMap.has(t.name))

    // Triggers to upsert: desired but hash differs or missing
    const toUpsert: TriggerMetadata[] = []
    desiredMap.forEach((desired) => {
      const desiredHash = this.computeTriggerHash(desired, discovery.propNameToColumnNames)
      const storedHash = storedHashes.get(desired.name)
      const triggerExists = existingSet.has(desired.name)

      if (!triggerExists || storedHash !== desiredHash) {
        toUpsert.push(desired)
      } else {
        this.logger.debug(`Trigger ${desired.name} unchanged, skipping`)
      }
    })

    if (toUpsert.length > 0) {
      await this.createTriggers(toUpsert, discovery.propNameToColumnNames)
    } else if (desiredMap.size > 0) {
      this.logger.log('All triggers are up-to-date, no DDL needed')
    }

    if (toRemove.length > 0) {
      await this.dropTriggers(toRemove)
    }
  }

  /**
   * Compute a deterministic MD5 hash for a trigger configuration.
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

  private async ensureMetaTable(): Promise<void> {
    await this.pgPool.query(`
      CREATE TABLE IF NOT EXISTS "${this.metaSchema}"."${this.metaTable}" (
        trigger_name TEXT PRIMARY KEY,
        config_hash TEXT NOT NULL
      )
    `)
  }

  private async loadStoredHashes(): Promise<Map<string, string>> {
    const rows = await this.pgPool.query<{ trigger_name: string; config_hash: string }>(`
      SELECT trigger_name, config_hash FROM "${this.metaSchema}"."${this.metaTable}"
    `)
    const map = new Map<string, string>()
    rows?.forEach((r) => map.set(r.trigger_name, r.config_hash))
    return map
  }

  private async listTriggers(): Promise<TriggerMetadata[]> {
    const triggers = await this.pgPool.query<{
      name: string
      schema: string
      table: string
    }>(`
      SELECT DISTINCT trigger_name as name, trigger_schema as schema, event_object_table as table
      FROM information_schema.triggers
      WHERE trigger_name LIKE '${this.config.triggerPrefix}_%'
    `)
    return (triggers ?? []).map((t) => ({ name: t.name, schema: t.schema, table: t.table }))
  }

  private async dropTriggers(triggers: TriggerMetadata[]): Promise<void> {
    if (!triggers.length) return

    this.logger.log(`Dropping triggers:\n${triggers.map((t) => `${t.schema}.${t.table}.${t.name}`).join(',\n')}`)
    await this.pgPool.query(triggers.map((t) => `DROP FUNCTION IF EXISTS ${t.schema}."${t.name}" CASCADE`).join('; '))

    // Clean up metadata
    const names = triggers.map((t) => `'${t.name}'`).join(', ')
    await this.pgPool.query(`DELETE FROM "${this.metaSchema}"."${this.metaTable}" WHERE trigger_name IN (${names})`)
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

            INSERT INTO "${this.config.queue?.schema ?? PG_PUBSUB_QUEUE_SCHEMA}"."${
              this.config.queue?.table ?? PG_PUBSUB_QUEUE_TABLE
            }"(channel, payload)
            VALUES ('${this.config.triggerPrefix}', payload)
            RETURNING id INTO inserted_id;

            PERFORM pg_notify('${this.config.triggerPrefix}', inserted_id::text);

            RETURN NEW;
          END;
          $BODY$
          LANGUAGE plpgsql;

          DROP TRIGGER IF EXISTS ${t.name} ON ${table};
        `)

        // Attach trigger only if the table exists
        const tableExists = await this.pgPool.query<{ exists: boolean }>(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = '${t.schema}' AND table_name = '${t.table}'
          ) as exists
        `)

        if (tableExists?.[0]?.exists) {
          await this.pgPool.query(`
            CREATE TRIGGER ${t.name}
            AFTER ${events.join(' OR ')} ON ${table}
            FOR EACH ROW EXECUTE FUNCTION ${t.schema}."${t.name}"()
          `)

          // Store hash only after successful trigger creation
          await this.pgPool.query(
            `INSERT INTO "${this.metaSchema}"."${this.metaTable}" (trigger_name, config_hash)
             VALUES ($1, $2)
             ON CONFLICT (trigger_name) DO UPDATE SET config_hash = $2`,
            [t.name, hash]
          )
        } else {
          this.logger.warn(`Table ${table} does not exist yet, trigger ${t.name} will be created on next restart`)
        }
      })
    )
  }
}
