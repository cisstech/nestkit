import { Injectable } from '@nestjs/common'
import { LockOptions, LockService } from './lock-service.interface'

/**
 * An in-memory implementation of the lock service.
 * This implementation is not distributed and only works within a single process.
 */
@Injectable()
export class InMemoryLockService implements LockService {
  private readonly locks = new Map<string, number>()

  async tryLock(options: LockOptions): Promise<void> {
    const { key, duration, onAccept, onReject } = options
    const now = Date.now()
    const existingLock = this.locks.get(key)

    if (existingLock && existingLock > now) {
      if (onReject) {
        await onReject()
      }
      return
    }

    this.locks.set(key, now + duration)

    try {
      await onAccept()
    } finally {
      // We could clear the lock here, but we want to respect the duration
      // so other concurrent processes will be rejected until the duration expires
      setTimeout(() => {
        if (this.locks.get(key) === now + duration) {
          this.locks.delete(key)
        }
      }, duration)
    }
  }
}
