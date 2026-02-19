import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { PoolClient } from 'pg'
import { LockOptions } from '../pg-pubsub'
import { hashStringToInt } from '../pg-pubsub.utils'
import { PgConnectionPoolService } from './pg-connection-pool.service'
/**
 * PostgreSQL advisory lock service.
 * Works across multiple processes sharing the same database.
 */
@Injectable()
export class PgLockService implements OnModuleDestroy {
  private readonly logger = new Logger(PgLockService.name)
  private readonly activeLocks = new Map<string, { timeout: NodeJS.Timeout; client: PoolClient }>()

  constructor(private readonly pgPool: PgConnectionPoolService) {}

  async onModuleDestroy(): Promise<void> {
    for (const [key, { timeout, client }] of this.activeLocks) {
      clearTimeout(timeout)
      try {
        const lockId = hashStringToInt(key)
        await client.query('SELECT pg_advisory_unlock($1)', [lockId])
        client.release()
      } catch {
        // Best-effort cleanup during shutdown
      }
    }
    this.activeLocks.clear()
  }

  async tryLock(options: LockOptions): Promise<void> {
    const { key, onAccept, onReject } = options

    // Use default duration of 10 seconds if not provided or invalid
    const duration = options.duration && options.duration > 0 ? options.duration : 10_000
    const lockId = hashStringToInt(key)

    let client: PoolClient | undefined

    try {
      client = await this.pgPool.acquireClient()

      const lockResult = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [lockId])

      if (lockResult.rows[0].acquired) {
        const existingLock = this.activeLocks.get(key)
        if (existingLock) {
          clearTimeout(existingLock.timeout)
          try {
            await existingLock.client.query('SELECT pg_advisory_unlock($1)', [lockId])
            existingLock.client.release()
          } catch {
            // Ignore errors releasing stale locks
          }
        }

        const timeout = setTimeout(async () => {
          try {
            await client?.query('SELECT pg_advisory_unlock($1)', [lockId])
          } catch (error) {
            this.logger.error(`Failed to release advisory lock for key ${key}`, error)
          } finally {
            client?.release()
            this.activeLocks.delete(key)
          }
        }, duration)

        this.activeLocks.set(key, { timeout, client })

        // If onAccept throws, clean up the lock to avoid double-release
        try {
          await onAccept()
        } catch (error) {
          // Cancel scheduled release to avoid double-release
          clearTimeout(timeout)
          this.activeLocks.delete(key)
          try {
            await client.query('SELECT pg_advisory_unlock($1)', [lockId])
          } catch {
            // Ignore unlock errors
          }
          client.release()
          client = undefined
          await onReject?.(error)
        }

        return
      }

      // Lock not acquired, release the client
      client.release()
      client = undefined

      await onReject?.()
    } catch (error) {
      if (client && !this.activeLocks.has(key)) {
        try {
          client.release()
        } catch {
          // Ignore release errors
        }
      }

      await onReject?.(error)
    }
  }
}
