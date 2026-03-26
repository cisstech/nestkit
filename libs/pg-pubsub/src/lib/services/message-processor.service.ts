import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  ListenerDiscovery,
  PG_PUBSUB_CONFIG,
  PG_PUBSUB_DRAIN_INTERVAL,
  PG_PUBSUB_QUEUE_CONCURRENCY,
  PgPubSubConfig,
  PgTableChangeContext,
  PgTableChangePayload,
  PgTableChanges,
  PgTableDeletePayload,
  PgTableInsertPayload,
  PgTableUpdatePayload,
  ResolvedListener,
  TransactionAdapter,
} from '../pg-pubsub'
import { Semaphore } from '../semaphore'
import { createEntity } from '../pg-pubsub.utils'
import { QueueService } from './queue.service'

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name)

  /** Whether a pull cycle is currently in progress. */
  private processing = false

  /** Whether a new pull has been requested while a cycle was in progress. */
  private pendingPull = false

  /** Delay between drain loop iterations in milliseconds. */
  private readonly drainInterval: number

  /** Limits parallel listener executions. */
  private readonly semaphore: Semaphore

  /** Optional transaction adapter provided by the application. */
  private readonly transactionAdapter?: TransactionAdapter

  constructor(
    private readonly queueService: QueueService,
    @Inject(PG_PUBSUB_CONFIG) config: PgPubSubConfig
  ) {
    this.drainInterval = config.queue?.drainInterval ?? PG_PUBSUB_DRAIN_INTERVAL
    this.semaphore = new Semaphore(config.queue?.concurrency ?? PG_PUBSUB_QUEUE_CONCURRENCY)
    this.transactionAdapter = config.transactionAdapter
  }

  /**
   * Pull pending messages from the queue and process them.
   *
   * Implements backpressure via semaphore + coalescing:
   * at most one pull cycle is active at any time. If a pull is already in
   * progress, the request is coalesced so that when the current cycle
   * finishes, a new fetch is triggered automatically.
   */
  async pullAndProcessMessages(channel: string, discoveryResult: ListenerDiscovery): Promise<void> {
    if (this.processing) {
      this.pendingPull = true
      return
    }

    this.processing = true

    try {
      do {
        this.pendingPull = false
        await this.doPullAndProcess(channel, discoveryResult)
      } while (this.pendingPull)
    } finally {
      this.processing = false
    }
  }

  private async doPullAndProcess(channel: string, discoveryResult: ListenerDiscovery): Promise<void> {
    try {
      let messages = await this.queueService.fetchPendingMessages(channel)

      while (messages.length > 0) {
        this.logger.log(`Processing ${messages.length} messages from queue for channel ${channel}`)

        // Process each message
        const payloads: PgTableChangePayload[] = []
        for (const message of messages) {
          try {
            const payload = message.payload as PgTableChangePayload<unknown>
            payload.id = message.id
            payload._metadata = {
              retry_count: message.retry_count,
              created_at: message.created_at,
            }

            switch (payload.event) {
              case 'INSERT':
                {
                  const insert = payload as PgTableInsertPayload<unknown>
                  insert.data = createEntity(
                    insert.table,
                    insert.data,
                    discoveryResult.tablesMap,
                    discoveryResult.columnNameToPropNames
                  )
                  payloads.push(insert)
                }
                break
              case 'UPDATE':
                {
                  const update = payload as PgTableUpdatePayload<unknown>
                  const oldData = createEntity(
                    update.table,
                    update.data.old,
                    discoveryResult.tablesMap,
                    discoveryResult.columnNameToPropNames
                  )
                  const newData = createEntity(
                    update.table,
                    update.data.new,
                    discoveryResult.tablesMap,
                    discoveryResult.columnNameToPropNames
                  )

                  update.data = {
                    new: newData,
                    old: oldData,
                    updatedFields: Object.keys(oldData as Record<string, unknown>).filter(
                      (key) => typeof oldData[key] !== 'object' && oldData[key] !== newData[key]
                    ),
                  }

                  payloads.push(update)
                }
                break
              case 'DELETE':
                {
                  const deletion = payload as PgTableDeletePayload<unknown>
                  deletion.data = createEntity(
                    deletion.table,
                    deletion.data,
                    discoveryResult.tablesMap,
                    discoveryResult.columnNameToPropNames
                  )

                  payloads.push(deletion)
                }
                break
            }
          } catch (error) {
            this.logger.error(`Error processing message ${message.id}:`, error)
            await this.queueService.markAsFailed([message.id])
          }
        }

        const startTime = Date.now()
        await this.processChanges(payloads, discoveryResult.listenersMap)
        this.logger.log(`Batch processed in ${Date.now() - startTime}ms`)

        if (this.drainInterval > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.drainInterval))
        }

        messages = await this.queueService.fetchPendingMessages(channel)
      }
    } catch (error) {
      this.logger.error('Error pulling messages:', error)
    }
  }

  /**
   * Route change payloads to appropriate table listeners.
   */
  private async processChanges<T>(
    payloads: PgTableChangePayload<T>[],
    listenersMap: Record<string, ResolvedListener<unknown>[]>
  ): Promise<void> {
    payloads = payloads.sort((a, b) => a.id - b.id)
    const groupByTables = payloads.reduce(
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
    const failedIds: number[] = []

    const tableBreakdown = Object.entries(groupByTables)
      .map(([table, changes]) => `${table}(${changes.length})`)
      .join(', ')
    this.logger.log(`Processing changes: ${tableBreakdown}`)

    for (const [table, changes] of Object.entries(groupByTables)) {
      const resolvedListeners = listenersMap[table] ?? []

      const inserts = changes.filter((c) => c.event === 'INSERT') as PgTableInsertPayload<T>[]
      const updates = changes.filter((c) => c.event === 'UPDATE') as PgTableUpdatePayload<T>[]
      const deletes = changes.filter((c) => c.event === 'DELETE') as PgTableDeletePayload<T>[]

      const changeIds = changes.map((c) => c.id)

      const batch: PgTableChanges<unknown> = {
        all: changes,
        INSERT: inserts || [],
        UPDATE: updates || [],
        DELETE: deletes || [],
      }

      for (const resolved of resolvedListeners) {
        this.logger.debug(
          `Routing ${changes.length} changes to ${resolved.instance.constructor.name} for table ${table}`
        )

        const task = this.executeListener(resolved, batch, changeIds, failedIds, table)
        promises.push(task)
      }
    }

    await Promise.all(promises)
    await this.queueService.markAsProcessed(payloads.filter((v) => !failedIds.includes(v.id)).map((v) => v.id))
    if (failedIds.length > 0) {
      await this.queueService.markAsFailed(failedIds)
    }
  }

  private async executeListener(
    resolved: ResolvedListener<unknown>,
    batch: PgTableChanges<unknown>,
    changeIds: number[],
    failedIds: number[],
    table: string
  ): Promise<void> {
    await this.semaphore.acquire()
    try {
      if (resolved.transactional && this.transactionAdapter) {
        await this.transactionAdapter.run(async (token) => {
          const ctx: PgTableChangeContext = {
            onError: () => {
              /* noop in transactional mode: throw to rollback instead */
            },
            transaction: token,
          }
          await resolved.instance.process(batch, ctx)
        })
      } else {
        const ctx: PgTableChangeContext = {
          onError: (ids) => failedIds.push(...ids),
        }
        await resolved.instance.process(batch, ctx)
      }
    } catch (error) {
      const stack = error instanceof Error ? error.stack : ''
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `Error processing changes for table ${table} in ${resolved.instance.constructor.name}: ${message}`,
        stack
      )
      failedIds.push(...changeIds)
    } finally {
      this.semaphore.release()
    }
  }
}
