import { DiscoveryService } from '@golevelup/nestjs-discovery'
import { Inject, Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata } from 'typeorm'
import {
  DiscoveredPgTableChangeListener,
  ListenerDiscovery,
  PG_PUBSUB_CONFIG,
  PG_PUBSUB_TRIGGER_SCHEMA,
  PgPubSubConfig,
  PgTableChangeListener,
  RegisterPgTableChangeListenerMeta,
  RegisterPgTableChangeListenerMetadata,
  ResolvedListener,
  TableListener,
} from '../pg-pubsub'

@Injectable()
export class ListenerDiscoveryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly dataSource: DataSource,
    @Inject(PG_PUBSUB_CONFIG) private readonly config: PgPubSubConfig
  ) {}

  /**
   * Discover table change listeners from the application.
   */
  async discoverListeners(): Promise<ListenerDiscovery> {
    const providers = await this.discoveryService.providersWithMetaAtKey<RegisterPgTableChangeListenerMetadata>(
      RegisterPgTableChangeListenerMeta
    )

    return this.processDiscoveredListeners(providers)
  }

  private processDiscoveredListeners(providers: DiscoveredPgTableChangeListener[]): ListenerDiscovery {
    const listeners: TableListener[] = []
    const entityMetadataList: EntityMetadata[] = []
    const tablesMap: Record<string, EntityMetadata> = {}
    const columnNameToPropNames: Record<string, Map<string, string>> = {}
    const propNameToColumnNames: Record<string, Map<string, string>> = {}

    providers.forEach((provider) => {
      const metadata = this.dataSource.getMetadata(provider.meta.target)
      entityMetadataList.push(metadata)

      const listener = listeners.find((l) => l.table === metadata.tableName)
      if (listener) {
        // If a listener for this table already exists, merge the events and payloadFields
        listener.schema =
          provider.meta.schema || listener.schema || this.config.triggerSchema || PG_PUBSUB_TRIGGER_SCHEMA
        listener.events = [...new Set([...(listener.events || []), ...(provider.meta.events || [])])]
        listener.payloadFields = [
          ...new Set([...(listener.payloadFields || []), ...(provider.meta.payloadFields || [])]),
        ] as string[]
        return
      }

      // Otherwise create a new listener
      listeners.push({
        table: metadata.tableName,
        schema: provider.meta.schema || this.config.triggerSchema || PG_PUBSUB_TRIGGER_SCHEMA,
        events: provider.meta.events,
        payloadFields: provider.meta.payloadFields as string[],
      })
    })

    const tableNames = listeners.map((t) => t.table)

    // Build listener map (table name -> array of resolved listener instances)
    const listenersMap = providers.reduce(
      (acc, provider) => {
        const tableMeta = this.dataSource.getMetadata(provider.meta.target)
        const { tableName } = tableMeta

        tablesMap[tableName] = tableMeta

        // Build column mappings for each table
        columnNameToPropNames[tableName] = new Map<string, string>(
          tableMeta.columns.map((c) => [c.databaseName, c.propertyName])
        )

        propNameToColumnNames[tableName] = new Map<string, string>(
          tableMeta.columns.map((c) => [c.propertyName, c.databaseName])
        )

        acc[tableName] = [
          ...(acc[tableName] || []),
          {
            instance: provider.discoveredClass.instance as PgTableChangeListener<unknown>,
            transactional: provider.meta.transactional ?? false,
          },
        ]
        return acc
      },
      {} as Record<string, ResolvedListener<unknown>[]>
    )

    return {
      tablesMap,
      tableNames,
      listeners,
      listenersMap,
      entityMetadataList,
      columnNameToPropNames,
      propNameToColumnNames,
    }
  }
}
