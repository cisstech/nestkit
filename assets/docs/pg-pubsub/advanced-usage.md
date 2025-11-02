# Advanced Usage

## Module Configuration Options

The library provides configuration options to customize its behavior. You can pass an optional configuration object when initializing the PgPubSubModule in your module.

```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PgPubSubModule } from '@cisstech/nestjs-pg-pubsub'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      /* your TypeORM config */
    }),
    PgPubSubModule.forRoot({
      databaseUrl: 'postgresql://user:password@localhost:5432/dbname',
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync('/path/to/ca.crt').toString(),
      },
      triggerSchema: 'myschema', // Default: 'public'
      triggerPrefix: 'my_trigger_prefix', // Default: 'pubsub_trigger'
      queue: {
        table: 'custom_queue_table', // Default: 'pg_pubsub_queue'
        maxRetries: 5, // Default: 5
        messageTTL: 24 * 60 * 60 * 1000, // Default: 24 hours
        cleanupInterval: 60 * 60 * 1000, // Default: 1 hour
      },
    }),
  ],
})
export class AppModule {}
```

- **ssl**: Optional SSL configuration for secure database connections. This is passed directly to the underlying `pg-listen` library (which uses `node-postgres`). You can provide any SSL options supported by `node-postgres`, such as:

  - `rejectUnauthorized`: Whether to reject unauthorized connections (set to `true` in production)
  - `ca`: Certificate authority certificate(s)
  - `key`: Client private key
  - `cert`: Client certificate

- **triggerPrefix**: Defines the prefix used for all database triggers dynamically created by the library. This is **critical** since during initialization, the library will automatically delete any existing database triggers whose names start with this prefix before creating new ones.

- **triggerSchema**: The PostgreSQL schema where the tables and triggers are located.

- **queue.table**: Name of the queue table to store messages.

- **queue.maxRetries**: Maximum number of retry attempts for failed messages.

- **queue.messageTTL**: How long to keep messages before they're cleaned up (in milliseconds).

- **queue.cleanupInterval**: How often to run the cleanup job (in milliseconds).

## Message Processing Architecture

The library uses a hybrid approach to message processing for optimal performance and reliability:

1. **Immediate Processing**: When a database change occurs, the trigger sends a notification with just the message ID. The service immediately pulls and processes that message.

2. **Fallback Polling**: In addition, a low-frequency polling mechanism ensures that no messages are missed, even if notifications are lost or the service is temporarily down.

3. **Ordered Processing**: Messages are processed in the order they were created, based on their ID.

4. **Transaction Safety**: The system uses PostgreSQL advisory locks and `SELECT FOR UPDATE SKIP LOCKED` to ensure messages are processed exactly once, even in distributed environments.

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

## Selective Error Handling

The library allows you to selectively mark specific messages as failed:

```typescript
@Injectable()
@RegisterPgTableChangeListener(User)
export class UserListener implements PgTableChangeListener<User> {
  async process(changes: PgTableChanges<User>, onError?: PgTableChangeErrorHandler): Promise<void> {
    // Process each message individually for fine-grained error handling
    for (const change of changes.all) {
      try {
        // Process the change
        await this.processChange(change)
      } catch (error) {
        // Mark only this specific message as failed
        onError?.([change.id])
        // Continue processing other messages
      }
    }
  }

  private async processChange(change: PgTableChangePayload<User>): Promise<void> {
    // Process a single change
  }
}
```

## Publishing Custom Events from PostgreSQL

You can publish custom events directly from PostgreSQL by sending a notification:

```sql
CREATE OR REPLACE FUNCTION notify_custom_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Send notification with just the message ID
  PERFORM pg_notify('custom-event', 'Hello world');
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
      console.log(`Received notification for message:`, payload)
    })
  }
}
```
