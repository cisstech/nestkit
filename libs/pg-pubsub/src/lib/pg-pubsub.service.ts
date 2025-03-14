import { DiscoveryService } from '@golevelup/nestjs-discovery'
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import createPostgresSubscriber, { Subscriber } from 'pg-listen'
import { Subject, Subscription, bufferTime, filter } from 'rxjs'
import { DataSource, EntityMetadata } from 'typeorm'
import {
  DiscoveredPgTableChangeListener,
  PG_PUBSUB_CONFIG,
  PG_PUBSUB_LOCK_SERVICE,
  PG_PUBSUB_TRIGGER_NAME,
  PgPubSubConfig,
  PgTableChangeListener,
  PgTableChangePayload,
  PgTableChangeType,
  PgTableDeletePayload,
  PgTableInsertPayload,
  PgTableUpdatePayload,
  RegisterPgTableChangeListenerMeta,
  RegisterPgTableChangeListenerMetadata,
} from './pg-pubsub'
import { LockService } from './lock'

type Trigger = {
  name: string
  table: string
  events?: PgTableChangeType[]
  payloadFields?: string[]
}

type Listener = {
  events?: PgTableChangeType[]
  tableName: string
  payloadFields?: string[]
}

/**
 * Service responsible for subscribing to PostgreSQL pub/sub triggers and handling table changes.
 */
@Injectable()
export class PgPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgPubSubService.name)
  private readonly buffer = new Subject<PgTableChangePayload>()

  private subscriber?: Subscriber
  private subscription?: Subscription

  private tableNames: string[] = []
  private tablesMap: Record<string, EntityMetadata> = {}

  /**
   * Map of columns for each table.
   * The key is the table name and the value is a map of column names to property names.
   */
  private columnNameToPropNames: Record<string, Map<string, string>> = {}

  /**
   * Map of columns for each table.
   * The key is the table name and the value is a map of property names to column names.
   */
  private propNameToColumnNames: Record<string, Map<string, string>> = {}

  /**
   * Map of listeners for each table received from the discovery service.
   */
  private listenersMap: Record<string, PgTableChangeListener<unknown>[]> = {}

  constructor(
    @Inject(PG_PUBSUB_CONFIG)
    private readonly config: PgPubSubConfig,
    @Inject(PG_PUBSUB_LOCK_SERVICE)
    private readonly lockService: LockService,
    private readonly dataSource: DataSource,
    private readonly discoveryService: DiscoveryService
  ) {}

  public async onModuleInit(): Promise<void> {
    const providers = await this.discoveryService.providersWithMetaAtKey<RegisterPgTableChangeListenerMetadata>(
      RegisterPgTableChangeListenerMeta
    )

    await this.injectPubSubTriggers(providers)
    await this.resume()
  }

  public async onModuleDestroy(): Promise<void> {
    this.subscription?.unsubscribe()
    await this.subscriber?.close()
  }

  /**
   * Pause the PostgreSQL listener.
   */
  public async pause(): Promise<void> {
    if (this.subscription) {
      this.subscription.unsubscribe()
      this.subscription = undefined
    }
    if (this.subscriber) {
      await this.subscriber.close()
      this.logger.log('PostgreSQL listener paused')
    }

    this.subscriber = undefined
    this.subscription = undefined
  }

  /**
   * Resume the PostgreSQL listener.
   */
  public async resume(): Promise<void> {
    if (!this.subscriber) {
      this.subscriber = createPostgresSubscriber(
        {
          connectionString: this.config.databaseUrl,
        },
        {
          retryInterval: (retryCount) => Math.min(1000 * 2 ** retryCount, 30000),
          retryTimeout: Number.POSITIVE_INFINITY,
        }
      )

      this.subscriber.events.on('error', (error) => {
        this.logger.error(error)
      })

      this.subscriber.events.on('reconnect', (attempt) => {
        this.logger.log(`Reconnecting to PostgreSQL (attempt ${attempt})`)
      })
    }

    await this.subscriber.connect()
    await this.watchPubSubTriggers()
    this.logger.log('PostgreSQL listener resumed')
  }

  /**
   * Suspend the PostgreSQL listener and run the provided action.
   * This is useful when you want to perform an action without being interrupted by the listener.
   * The listener will be resumed after the action is completed.
   * @param action The action to run while the listener is suspended.
   */
  public async suspendAndRun(action: () => Promise<void>): Promise<void> {
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
  public async susbcribe<T>(channel: string, callback: (payload: T) => void): Promise<void> {
    await this.subscriber?.listenTo(channel)
    this.subscriber?.notifications.on(channel, callback)
  }

  /**
   * Process the changes received from PostgreSQL.
   * @param value The changes received from PostgreSQL.
   */
  private async processChanges<T>(value: PgTableChangePayload<T>[]): Promise<void> {
    const groupByTables = value.reduce(
      (acc, change) => {
        const tableName = change.table
        if (!acc[tableName]) {
          acc[tableName] = []
        }
        acc[tableName].push(change)
        return acc
      },
      {} as Record<string, PgTableChangePayload[]>
    )

    const promises: Promise<void>[] = []
    for (const [table, changes] of Object.entries(groupByTables)) {
      const listeners = this.listenersMap[table] ?? []

      const inserts = changes.filter((c) => c.event === 'INSERT') as PgTableInsertPayload<T>[]
      const updates = changes.filter((c) => c.event === 'UPDATE') as PgTableUpdatePayload<T>[]
      const deletes = changes.filter((c) => c.event === 'DELETE') as PgTableDeletePayload<T>[]

      listeners.forEach((listener) => {
        promises.push(
          listener.process({
            all: changes,
            INSERT: inserts || [],
            UPDATE: updates || [],
            DELETE: deletes || [],
          })
        )
      })
    }

    try {
      await Promise.all(promises)
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Watch the PostgreSQL pub/sub triggers and start handling table changes.
   *
   * This is done by subscribing to the `pg_pubsub` channel and buffering the received events.
   * The events are then grouped by table and sent to the corresponding listener.
   *
   * @see {@link processChanges}
   *
   */
  private async watchPubSubTriggers(): Promise<void> {
    this.logger.log(`Watching trigger for tables:\n${this.tableNames.join(',\n')}`)

    this.subscription = this.buffer
      .pipe(
        bufferTime(1000), // bufferize events for a specific time interval
        filter((buffer) => buffer.length > 0) // filter out empty buffers
      )
      .subscribe(this.processChanges.bind(this))

    await this.susbcribe<PgTableChangePayload<unknown>>(PG_PUBSUB_TRIGGER_NAME, async (payload) => {
      const key = `pg_pubsub_${payload.table}_${payload.event}_${payload.id}`
      await this.lockService.tryLock({
        key,
        duration: 3_000,
        onAccept: () => this.handlePgTableChange(payload),
      })
    })
  }

  private handlePgTableChange(payload: PgTableChangePayload<unknown>) {
    this.logger.log(`Received change for table ${payload.table}: ${payload.event}(${payload.id})`)
    try {
      switch (payload.event) {
        case 'INSERT':
          {
            const insert = payload as PgTableInsertPayload<unknown>
            insert.data = this.createEntity(insert.table, insert.data)
            this.buffer.next(insert)
          }
          break
        case 'UPDATE':
          {
            const update = payload as PgTableUpdatePayload<unknown>
            const oldData = this.createEntity(update.table, update.data.old)
            const newData = this.createEntity(update.table, update.data.new)

            update.data = {
              new: newData,
              old: oldData,
              updatedFields: Object.keys(oldData as Record<string, unknown>).filter(
                (key) => typeof oldData[key] !== 'object' && oldData[key] !== newData[key]
              ),
            }

            this.buffer.next(update)
          }
          break
        case 'DELETE':
          {
            const deletion = payload as PgTableDeletePayload<unknown>
            deletion.data = this.createEntity(deletion.table, deletion.data)

            this.buffer.next(deletion)
          }
          break
      }
    } catch (error) {
      this.logger.error('An error occurred while handling change', error)
    }
  }

  /**
   * Inject the PostgreSQL pub/sub triggers.
   * This is done by creating a PostgreSQL function that creates triggers for the specified tables.
   * The triggers will then send a notification to the `pg_pubsub` channel when a change occurs.
   *
   * @param providers The discovered PostgreSQL table change listeners.
   */
  private async injectPubSubTriggers(providers: DiscoveredPgTableChangeListener[]): Promise<void> {
    const schema = 'public'

    const listeners = this.createListenersFromProviders(providers)

    await this.lockService.tryLock({
      key: 'pg_pubsub',
      duration: 1000,
      onAccept: async () => {
        await this.dropTriggers(schema, await this.listTriggers(schema))
        await this.createTriggers(
          schema,
          listeners.map<Trigger>((listener) => ({
            table: listener.tableName,
            name: `${PG_PUBSUB_TRIGGER_NAME}_${listener.tableName.toLowerCase()}`,
            events: listener.events,
            payloadFields: listener.payloadFields,
          }))
        )
      },
      onReject: () => this.logger.warn('Failed to acquire lock for pg_pubsub'),
    })
  }

  private async dropTriggers(schema: string, triggers: Trigger[]) {
    if (!triggers.length) return

    this.logger.log(`Dropping triggers:\n${triggers.map((t) => `${t.table}.${t.name}`).join(',\n')}`)
    await this.dataSource.query(triggers.map((t) => `DROP FUNCTION IF EXISTS ${schema}."${t.name}" CASCADE`).join('; '))
  }

  private async createTriggers(schema: string, triggers: Trigger[]) {
    if (!triggers.length) return

    this.logger.log(`Creating triggers:\n${triggers.map((t) => `${t.table}.${t.name}`).join(',\n')}`)

    await Promise.all(
      triggers.map(async (t) => {
        const table = `"${schema}"."${t.table}"`
        const payloadFields = t.payloadFields
        const columns = this.propNameToColumnNames[t.table]

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

        await this.dataSource.query(`
          -- Create the trigger function
          CREATE OR REPLACE FUNCTION ${t.name}()
          RETURNS TRIGGER
          AS $BODY$
          DECLARE
          payload JSON;
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
            PERFORM pg_notify('${PG_PUBSUB_TRIGGER_NAME}', payload::text);
            RETURN NEW;
          END;
          $BODY$
          LANGUAGE plpgsql;

          -- Drop the trigger if it already exists
          DROP TRIGGER IF EXISTS ${t.name} ON ${table};

          -- Create the trigger
          CREATE TRIGGER ${t.name}
          AFTER ${events.join(' OR ')} ON ${table}
          FOR EACH ROW EXECUTE FUNCTION ${t.name}();
        `)
      })
    )
  }

  private async listTriggers(schema: string): Promise<Trigger[]> {
    return (
      (await this.dataSource.query<Trigger[]>(`
        SELECT
          DISTINCT(trigger_name) as name,
          event_object_table as table
        FROM information_schema.triggers
        WHERE trigger_schema = '${schema}'
        AND trigger_name LIKE '${PG_PUBSUB_TRIGGER_NAME}_%'`)) ?? []
    )
  }

  /**
   * Create and return an entity based on the table name and data received from PostgreSQL.
   * @param tableName The name of the table.
   * @param data The data received from PostgreSQL.
   * @returns The created entity.
   */
  private createEntity(tableName: string, data: unknown): Record<string, unknown> {
    const table = this.tablesMap[tableName]
    const columns = this.columnNameToPropNames[tableName]
    const entity = table.create()
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const propertyName = columns.get(key)
      if (propertyName) {
        entity[propertyName] = value
      }
    }
    return entity
  }

  private createListenersFromProviders(providers: DiscoveredPgTableChangeListener[]) {
    const listeners: Listener[] = []
    providers.forEach((provider) => {
      const metadata = this.dataSource.getMetadata(provider.meta.target)

      const listener = listeners.find((l) => l.tableName === metadata.tableName)
      if (listener) {
        listener.events = [...new Set([...(listener.events || []), ...(provider.meta.events || [])])]
        listener.payloadFields = [
          ...new Set([...(listener.payloadFields || []), ...(provider.meta.payloadFields || [])]),
        ] as string[]
      } else {
        listeners.push({
          tableName: metadata.tableName,
          events: provider.meta.events,
          payloadFields: provider.meta.payloadFields as string[],
        })
      }
    })

    this.tableNames = listeners.map((t) => t.tableName)
    this.tablesMap = {}
    this.columnNameToPropNames = {}
    this.listenersMap = providers.reduce(
      (acc, provider) => {
        const tableMeta = this.dataSource.getMetadata(provider.meta.target)
        const { tableName } = tableMeta

        this.tablesMap[tableName] = tableMeta
        this.columnNameToPropNames[tableName] = new Map<string, string>(
          tableMeta.columns.map((c) => [c.databaseName, c.propertyName])
        )
        this.propNameToColumnNames[tableName] = new Map<string, string>(
          tableMeta.columns.map((c) => [c.propertyName, c.databaseName])
        )

        acc[tableName] = [
          ...(acc[tableName] || []),
          provider.discoveredClass.instance as PgTableChangeListener<unknown>,
        ]
        return acc
      },
      {} as Record<string, PgTableChangeListener<unknown>[]>
    )

    return listeners
  }
}
