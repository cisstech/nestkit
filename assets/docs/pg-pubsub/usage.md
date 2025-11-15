# Usage

## 1. Module Registration

First, register the PgPubSub module in your application:

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
      // Optional: SSL configuration for secure connections
      ssl: {
        rejectUnauthorized: false,
      },
      // Optional queue configuration
      queue: {
        maxRetries: 5, // Default: 5
        messageTTL: 24 * 60 * 60 * 1000, // Default: 24 hours
        cleanupInterval: 60 * 60 * 1000, // Default: 1 hour
        table: 'pg_pubsub_queue', // Default: 'pg_pubsub_queue'
      },
    }),
  ],
})
export class AppModule {}
```

## 2. Define Your Entities

Create TypeORM entities for the tables you want to monitor:

```typescript
// user.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ unique: true })
  email: string
}
```

## 3. Create Table Change Listeners

Create classes that implement the `PgTableChangeListener` interface and decorate them with `@RegisterPgTableChangeListener`:

```typescript
import { Injectable } from '@nestjs/common'
import {
  RegisterPgTableChangeListener,
  PgTableChangeListener,
  PgTableChanges,
  PgTableChangeErrorHandler,
} from '@cisstech/nestjs-pg-pubsub'
import { User } from './entities/user.entity'

@Injectable()
@RegisterPgTableChangeListener(User)
export class UserTableChangeListener implements PgTableChangeListener<User> {
  async process(changes: PgTableChanges<User>, onError?: PgTableChangeErrorHandler): Promise<void> {
    try {
      // Process all changes
      changes.all.forEach((change) => {
        console.log(`Change type: ${change.event} for user with id: ${change.data.id}`)

        // Access metadata for retry information
        if (change._metadata) {
          console.log(`Retry count: ${change._metadata.retry_count}`)
          console.log(`Created at: ${change._metadata.created_at}`)
        }
      })

      // Process inserts
      changes.INSERT.forEach((insert) => {
        console.log(`New user created: ${insert.data.email}`)
      })

      // Process updates
      changes.UPDATE.forEach((update) => {
        console.log(`User updated: ${update.data.new.email} (was: ${update.data.old.email})`)
        console.log(`Updated fields: ${update.data.updatedFields.join(', ')}`)
      })

      // Process deletes
      changes.DELETE.forEach((deletion) => {
        console.log(`User deleted: ${deletion.data.email}`)
      })
    } catch (error) {
      // Mark specific messages as failed to be retried later
      // Each change has an 'id' property that can be used for this purpose
      if (onError) {
        const failedIds = changes.all.map((change) => change.id)
        onError(failedIds)
      }
      throw error
    }
  }
}
```

## 4. Register Your Listeners

Make sure to provide your listener in your module:

```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PgPubSubModule } from '@cisstech/nestjs-pg-pubsub'
import { User } from './entities/user.entity'
import { UserTableChangeListener } from './listeners/user-table-change.listener'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PgPubSubModule.forRoot({
      databaseUrl: process.env.DATABASE_URL,
    }),
  ],
  providers: [UserTableChangeListener],
})
export class UserModule {}
```

## 5. Customizing Your Listeners

You can customize what events to listen for and which fields to include in the payload:

```typescript
@Injectable()
@RegisterPgTableChangeListener(User, {
  events: ['INSERT', 'UPDATE'], // Only listen for INSERT and UPDATE events
  payloadFields: ['id', 'email'], // Only include id and email in the payload
})
export class UserTableChangeListener implements PgTableChangeListener<User> {
  // Implementation...
}
```

## 6. Error Handling

The library provides comprehensive error handling:

```typescript
async process(changes: PgTableChanges<User>, onError?: PgTableChangeErrorHandler): Promise<void> {
  try {
    // Process changes...

    // If you need to mark specific messages as failed:
    if (someCondition && onError) {
      // Mark specific messages for retry
      onError([changes.all[0].id, changes.all[1].id]);
      return; // Exit early, no need to throw
    }

    // Continue processing...
  } catch (error) {
    // For unhandled errors, mark all messages as failed
    if (onError) {
      onError(changes.all.map(change => change.id));
    }
  }
}
```

## 7. Subscribe to Custom Events

Besides table changes, you can also subscribe to custom PostgreSQL notification events:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common'
import { PgPubSubService } from '@cisstech/nestjs-pg-pubsub'

@Injectable()
export class CustomEventService implements OnModuleInit {
  constructor(private readonly pgPubSubService: PgPubSubService) {}

  async onModuleInit(): Promise<void> {
    await this.pgPubSubService.susbcribe<{ userId: string; action: string }>('custom-event', (payload) => {
      console.log(`Custom event received for user ${payload.userId}: ${payload.action}`)
    })
  }
}
```
