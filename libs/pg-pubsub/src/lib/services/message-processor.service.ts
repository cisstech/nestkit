import { Injectable, Logger } from '@nestjs/common'
import {
  ListenerDiscovery,
  PgTableChangeListener,
  PgTableChangePayload,
  PgTableChanges,
  PgTableDeletePayload,
  PgTableInsertPayload,
  PgTableUpdatePayload,
} from '../pg-pubsub'
import { createEntity } from '../pg-pubsub.utils'
import { QueueService } from './queue.service'

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name)

  /** Whether a pull cycle is currently in progress. */
  private processing = false

  /** Whether a new pull has been requested while a cycle was in progress. */
  private pendingPull = false

  constructor(private readonly queueService: QueueService) {}

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
      const messages = await this.queueService.fetchPendingMessages(channel)

      if (messages.length === 0) return

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

      await this.processChanges(payloads, discoveryResult.listenersMap)
    } catch (error) {
      this.logger.error('Error pulling messages:', error)
    }
  }

  /**
   * Route change payloads to appropriate table listeners.
   */
  private async processChanges<T>(
    payloads: PgTableChangePayload<T>[],
    listenersMap: Record<string, PgTableChangeListener<unknown>[]>
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

    for (const [table, changes] of Object.entries(groupByTables)) {
      const listeners = listenersMap[table] ?? []

      const inserts = changes.filter((c) => c.event === 'INSERT') as PgTableInsertPayload<T>[]
      const updates = changes.filter((c) => c.event === 'UPDATE') as PgTableUpdatePayload<T>[]
      const deletes = changes.filter((c) => c.event === 'DELETE') as PgTableDeletePayload<T>[]

      listeners.forEach((listener) => {
        promises.push(
          listener
            .process(
              {
                all: changes,
                INSERT: inserts || [],
                UPDATE: updates || [],
                DELETE: deletes || [],
              } as PgTableChanges<unknown>,
              (ids) => failedIds.push(...ids)
            )
            .catch((error) => {
              this.logger.error(`Error processing changes for table ${table}:`, error)
            })
        )
      })
    }

    await Promise.all(promises)
    await this.queueService.markAsProcessed(payloads.filter((v) => !failedIds.includes(v.id)).map((v) => v.id))
    if (failedIds.length > 0) {
      await this.queueService.markAsFailed(failedIds)
    }
  }
}
