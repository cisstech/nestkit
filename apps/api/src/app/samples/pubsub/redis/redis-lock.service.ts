import { LockOptions, LockService } from '@cisstech/nestjs-pg-pubsub'
import { Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'

@Injectable()
export class RedisLockService implements LockService {
  private readonly redis: Redis

  constructor() {
    // Connect to Redis using configuration
    this.redis = new Redis({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
    })
  }

  async tryLock(options: LockOptions): Promise<void> {
    const { key, duration, onAccept, onReject } = options

    // Using Redis to implement distributed locking
    const lockKey = `lock:${key}`
    const now = Date.now()
    const expiryTime = now + duration

    // Try to acquire the lock using SET NX (only set if not exists)
    const acquired = await this.redis.set(lockKey, expiryTime, 'PX', duration, 'NX')

    if (acquired) {
      try {
        // Lock acquired, execute the callback
        await onAccept()
      } finally {
        // Release lock only if it's still ours
        const script = `
          if redis.call('get', KEYS[1]) == ARGV[1] then
            return redis.call('del', KEYS[1])
          else
            return 0
          end
        `
        await this.redis.eval(script, 1, lockKey, expiryTime.toString())
      }
    } else if (onReject) {
      // Lock was not acquired, execute the rejection callback if provided
      await onReject()
    }
  }
}
