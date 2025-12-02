# @cisstech/nestjs-pg-pubsub

<div align="center">

A NestJS module for real-time PostgreSQL notifications using PubSub

[![CI](https://github.com/cisstech/nestkit/actions/workflows/ci.yml/badge.svg)](https://github.com/cisstech/nestkit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/cisstech/nestkit/branch/main/graph/badge.svg)](https://codecov.io/gh/cisstech/nestkit)
[![codefactor](https://www.codefactor.io/repository/github/cisstech/nestkit/badge/main)](https://www.codefactor.io/repository/github/cisstech/nestkit/overview/main)
[![GitHub Tag](https://img.shields.io/github/tag/cisstech/nestkit.svg)](https://github.com/cisstech/nestkit/tags)
[![npm package](https://img.shields.io/npm/v/@cisstech/nestjs-pg-pubsub.svg)](https://www.npmjs.org/package/@cisstech/nestjs-pg-pubsub)
[![NPM downloads](http://img.shields.io/npm/dm/@cisstech/nestjs-pg-pubsub.svg)](https://npmjs.org/package/@cisstech/nestjs-pg-pubsub)
[![licence](https://img.shields.io/github/license/cisstech/nestkit)](https://github.com/cisstech/nestkit/blob/main/LICENSE)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

</div>

## Overview

The NestJS PG-PubSub library is a powerful tool that facilitates real-time communication between your NestJS application and PostgreSQL database using the native PostgreSQL Pub/Sub mechanism. It allows your application to listen for changes on specific database tables and respond to those changes in real-time, making it ideal for building reactive applications with immediate data synchronization and event-driven workflows.

![Diagram](./mermaid.png)

## Features

- **Real-Time Table Change Detection**: Automatically listen for INSERT, UPDATE, and DELETE events on PostgreSQL tables
- **Decorator-Based Configuration**: Use intuitive decorators to register table change listeners
- **Automatic Trigger Management**: Dynamically creates and manages PostgreSQL triggers
- **Event Buffering and Batching**: Optimizes performance by buffering and batching events
- **Entity Mapping**: Maps database column names to entity property names automatically
- **Persistent Message Queue**: Messages are stored in a PostgreSQL table to prevent data loss
- **Reactive Processing**: Immediately pulls and processes messages when notifications are received
- **TTL and Retry System**: Implements time-to-live and automatic retries for failed message processing
- **Queue Metadata**: Exposes retry count and creation timestamp to prevent stale data operations
- **Message Ordering**: Preserves message processing order using row IDs
- **Error Handling**: Provides mechanisms to handle and retry failed messages
- **Auto Cleanup**: Automatically removes old processed messages to keep the queue size manageable
- **Multiple Subscribers**: Leverages PostgreSQL's native Pub/Sub to allow multiple instances of your application to subscribe to the same database events
- **Fallback Reliability**: Includes low-frequency background polling to ensure no messages are missed

## Installation

```bash
yarn add @cisstech/nestjs-pg-pubsub
```

### NestJS Version Compatibility

This library supports both **NestJS v10** and **NestJS v11**:

- ✅ NestJS v10.x
- ✅ NestJS v11.x

## Usage

### 1. Register the Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PgPubSubModule } from '@cisstech/nestjs-pg-pubsub'
import { UserTableChangeListener } from './user-change.listener'

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
        maxRetries: 5,
        messageTTL: 24 * 60 * 60 * 1000, // 24 hours
        cleanupInterval: 60 * 60 * 1000, // 1 hour
        table: 'pg_pubsub_queue',
      },
    }),
  ],
  providers: [UserTableChangeListener],
})
export class AppModule {}
```

### 2. Create Table Change Listeners

Create a class that implements the `PgTableChangeListener<T>` interface and decorate it with `@RegisterPgTableChangeListener`:

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
@RegisterPgTableChangeListener(User, {
  events: ['INSERT', 'UPDATE'], // Optional: specify which events to listen for
  payloadFields: ['id', 'email'], // Optional: specify which fields to include in the payload
})
export class UserTableChangeListener implements PgTableChangeListener<User> {
  async process(changes: PgTableChanges<User>, onError?: PgTableChangeErrorHandler): Promise<void> {
    try {
      // Handle table changes here

      // Process all changes
      changes.all.forEach((change) => {
        console.log(`Change type: ${change.event} for user with id: ${change.data.id}`)

        // Access metadata for retry information
        if (change._metadata) {
          console.log(`Retry count: ${change._metadata.retry_count}`)
          console.log(`Created at: ${change._metadata.created_at}`)

          // Perform different operations on retry events
          if (change._metadata.retry_count >= 1) {
            console.log('This is a retry - consider fetching latest data from DB')
          }
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
    } catch {
      // If processing fails, mark all messages as failed for retry
      if (onError) {
        onError(changes.all.map((change) => change.id))
      }
    }
  }
}
```

### 3. Subscribe to Custom Events

You can also subscribe to custom PostgreSQL notification events:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common'
import { PgPubSubService } from '@cisstech/nestjs-pg-pubsub'

@Injectable()
export class CustomEventService implements OnModuleInit {
  constructor(private readonly pgPubSubService: PgPubSubService) {}

  async onModuleInit(): Promise<void> {
    await this.pgPubSubService.susbcribe<number>('custom-event', (payload) => {
      console.log(`Received notification:`, payload)
    })
  }
}
```

### 4. Publishing Custom Events from PostgreSQL

You can publish custom events from PostgreSQL by inserting into the queue table:

```sql
-- Example trigger function that publishes a custom event
CREATE OR REPLACE FUNCTION notify_custom_event() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('custom-event', 'Hello world');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_event_trigger
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE PROCEDURE notify_custom_event();
```

## How It Works

### Queue-Based Architecture with Reactive Processing

This library implements a hybrid queue-based approach to ensure reliable and efficient message processing:

1. **Message Storage**: When a database change occurs, a trigger function:

   - Generates a payload with change details
   - Inserts the payload into a queue table
   - Sends a notification with just the message ID

2. **Message Processing**:

   - The application listens for notifications and immediately pulls messages when notified
   - Messages are processed in order using `SELECT FOR UPDATE SKIP LOCKED`
   - A low-frequency fallback polling mechanism ensures no messages are missed
   - Successful processing marks messages as processed

3. **Reliability Features**:
   - Message persistence: All changes are stored in the database
   - Retry mechanism: Failed messages are retried with exponential backoff
   - TTL management: Old messages are automatically cleaned up
   - Ordering: Messages are processed in the order they were created

This approach combines the best of both worlds: reactive performance and reliable delivery.

## Documentation

For detailed documentation, examples, and advanced usage, please refer to the official documentation at <https://cisstech.github.io/nestkit/docs/nestjs-pg-pubsub/getting-started>

## License

MIT © [Mamadou Cisse](https://github.com/cisstech)
