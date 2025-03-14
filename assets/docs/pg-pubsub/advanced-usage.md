# Advanced Usage

## Controlling the Listener

The library provides methods to control the behavior of the PostgreSQL listener at runtime:

### Pause and Resume

You can pause and resume the listener as needed:

```typescript
import { Injectable } from '@nestjs/common'
import { PgPubSubService } from '@cisstech/nestjs-pg-pubsub'

@Injectable()
export class ListenerControlService {
  constructor(private readonly pgPubSubService: PgPubSubService) {}

  async pauseListener(): Promise<void> {
    await this.pgPubSubService.pause()
  }

  async resumeListener(): Promise<void> {
    await this.pgPubSubService.resume()
  }
}
```

### Suspend and Run

Sometimes you might want to temporarily suspend the listener while performing certain operations:

```typescript
import { Injectable } from '@nestjs/common'
import { PgPubSubService } from '@cisstech/nestjs-pg-pubsub'

@Injectable()
export class DataService {
  constructor(private readonly pgPubSubService: PgPubSubService) {}

  async performBulkOperations(): Promise<void> {
    // Suspend the listener while performing bulk operations
    await this.pgPubSubService.suspendAndRun(async () => {
      // Perform your operations here
      // No events will be processed during this time
    })
    // Listener is automatically resumed after the callback completes
  }
}
```

## Custom Lock Service

The library uses a locking mechanism to prevent duplicate processing of events. By default, it uses an in-memory implementation, but you can provide your own implementation for distributed environments:

### Redis Lock Service Example

```typescript
import { Injectable } from '@nestjs/common'
import { LockService, LockOptions } from '@cisstech/nestjs-pg-pubsub'
import { Redis } from 'ioredis'

@Injectable()
export class RedisLockService implements LockService {
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
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
```

> You might consider using [@anchan828/nest-redlock](https://www.npmjs.com/package/@anchan828/nest-redlock) also for distributed locking.

### Register the Custom Lock Service

```typescript
import { Module } from '@nestjs/common'
import { PgPubSubModule } from '@cisstech/nestjs-pg-pubsub'
import { RedisLockService } from './redis-lock.service'

@Module({
  imports: [
    PgPubSubModule.forRoot({
      databaseUrl: process.env.DATABASE_URL,
      lockService: new RedisLockService(),
    }),
  ],
})
export class AppModule {}
```

## Multiple Listeners for the Same Table

You can register multiple listeners for the same table to handle different aspects of changes:

```typescript
@Injectable()
@RegisterPgTableChangeListener(User, { events: ['INSERT'] })
export class UserCreationListener implements PgTableChangeListener<User> {
  async process(changes: PgTableChanges<User>): Promise<void> {
    // Handle only new user creation
  }
}

@Injectable()
@RegisterPgTableChangeListener(User, { events: ['UPDATE'] })
export class UserUpdateListener implements PgTableChangeListener<User> {
  async process(changes: PgTableChanges<User>): Promise<void> {
    // Handle only user updates
  }
}
```

The library will automatically merge the event registrations into a single PostgreSQL trigger function for optimal performance.

## Publishing Custom Events from PostgreSQL

You can publish custom events directly from PostgreSQL using triggers:

```sql
CREATE OR REPLACE FUNCTION notify_custom_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('custom-event', json_build_object(
    'userId', NEW.id,
    'action', 'login',
    'timestamp', extract(epoch from now())
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_login_trigger
  AFTER INSERT ON user_login_history
  FOR EACH ROW
  EXECUTE PROCEDURE notify_custom_event();
```

Then subscribe to these events in your NestJS application:

```typescript
@Injectable()
export class AuthEventsService implements OnModuleInit {
  constructor(private readonly pgPubSubService: PgPubSubService) {}

  async onModuleInit(): Promise<void> {
    await this.pgPubSubService.susbcribe('custom-event', (payload) => {
      // Handle the custom event
      this.logger.log(`User ${payload.userId} performed ${payload.action}`)
    })
  }
}
```
