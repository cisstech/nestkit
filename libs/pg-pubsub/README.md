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

## Features

- **Real-Time Table Change Detection**: Automatically listen for INSERT, UPDATE, and DELETE events on PostgreSQL tables
- **Decorator-Based Configuration**: Use intuitive decorators to register table change listeners
- **Automatic Trigger Management**: Dynamically creates and manages PostgreSQL triggers
- **Event Buffering and Batching**: Optimizes performance by buffering and batching events
- **Entity Mapping**: Maps database column names to entity property names automatically
- **Configurable Locking Mechanism**: Built-in locking system with configurable implementation
- **Custom Event Support**: Subscribe to and handle custom PostgreSQL notification events
- **Suspend/Resume Capability**: Control when the listeners should be active

## Installation

```bash
yarn add @cisstech/nestjs-pg-pubsub
```

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
      // Optionally provide a custom lock service
      // lockService: customLockService,
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
import { RegisterPgTableChangeListener, PgTableChangeListener, PgTableChanges } from '@cisstech/nestjs-pg-pubsub'
import { User } from './entities/user.entity'

@Injectable()
@RegisterPgTableChangeListener(User, {
  events: ['INSERT', 'UPDATE'], // Optional: specify which events to listen for
  payloadFields: ['id', 'email'], // Optional: specify which fields to include in the payload
})
export class UserTableChangeListener implements PgTableChangeListener<User> {
  async process(changes: PgTableChanges<User>): Promise<void> {
    // Handle table changes here

    // Process all changes
    changes.all.forEach((change) => {
      console.log(`Change type: ${change.event} for user with id: ${change.data.id}`)
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
    await this.pgPubSubService.susbcribe<{ userId: string; action: string }>('custom-event', (payload) => {
      console.log(`Custom event received for user ${payload.userId}: ${payload.action}`)
    })
  }
}
```

### 4. Publishing Custom Events from PostgreSQL

You can publish custom events from PostgreSQL using the `pg_notify` function:

```sql
-- Example trigger function that publishes a custom event
CREATE OR REPLACE FUNCTION notify_custom_event() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('custom-event', json_build_object('userId', NEW.id, 'action', 'custom_action')::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_event_trigger
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE PROCEDURE notify_custom_event();
```

## Documentation

For detailed documentation, examples, and advanced usage, please refer to the official documentation at <https://cisstech.github.io/nestkit/docs/nestjs-pg-pubsub/getting-started>

## License

MIT © [Mamadou Cisse](https://github.com/cisstech)
