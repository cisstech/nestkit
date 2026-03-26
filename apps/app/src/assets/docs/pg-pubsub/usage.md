# Usage

## Module Registration

```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PgPubSubModule } from '@cisstech/nestjs-pg-pubsub'
import { UserChangeListener } from './listeners/user-change.listener'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      /* ... */
    }),
    PgPubSubModule.forRoot({
      databaseUrl: process.env.DATABASE_URL,
    }),
  ],
  providers: [UserChangeListener],
})
export class AppModule {}
```

That's all. The library creates the queue table and triggers on startup.

## Listening to Table Changes

Decorate a class with `@RegisterPgTableChangeListener` and implement `PgTableChangeListener<T>`:

```typescript
@Injectable()
@RegisterPgTableChangeListener(User)
export class UserChangeListener implements PgTableChangeListener<User> {
  async process(changes: PgTableChanges<User>, ctx: PgTableChangeContext): Promise<void> {
    for (const insert of changes.INSERT) {
      console.log(`New user: ${insert.data.email}`)
    }

    for (const update of changes.UPDATE) {
      console.log(`Updated: ${update.data.updatedFields.join(', ')}`)
      // update.data.old and update.data.new are available
    }

    for (const deletion of changes.DELETE) {
      console.log(`Deleted: ${deletion.data.email}`)
    }
  }
}
```

### Filtering Events and Fields

```typescript
@RegisterPgTableChangeListener(User, {
  events: ['INSERT', 'UPDATE'],     // only these events (default: all)
  payloadFields: ['id', 'email'],   // only these columns in the payload (default: all)
})
```

### Error Handling

Use `ctx.onError` to mark specific messages as failed. They will be retried with exponential backoff.

```typescript
async process(changes: PgTableChanges<User>, ctx: PgTableChangeContext): Promise<void> {
  for (const change of changes.all) {
    try {
      await this.doSomething(change)
    } catch {
      ctx.onError([change.id])  // this message will be retried
    }
  }
}
```

If the entire `process()` method throws without calling `ctx.onError`, all messages in the batch are marked as failed.

### Retry Metadata

Each payload carries `_metadata` with `retry_count` (0 on first attempt) and `created_at`. This is useful when syncing to external systems: on retry, fetch fresh data from the DB instead of using the potentially stale payload:

```typescript
const retryCount = change._metadata?.retry_count ?? 0
if (retryCount >= 1) {
  const fresh = await this.userRepo.findOneBy({ id: change.data.id })
  if (!fresh) return // deleted since, skip
  await this.syncToExternalSystem(fresh)
} else {
  await this.syncToExternalSystem(change.data)
}
```

## Multiple Listeners per Table

Multiple listeners on the same table are supported. The library merges their event registrations into a single trigger:

```typescript
@RegisterPgTableChangeListener(User, { events: ['INSERT'] })
export class UserCreationListener implements PgTableChangeListener<User> {
  /* ... */
}

@RegisterPgTableChangeListener(User, { events: ['UPDATE'] })
export class UserUpdateListener implements PgTableChangeListener<User> {
  /* ... */
}
```

## Custom NOTIFY Subscriptions

You can also subscribe to arbitrary PostgreSQL `NOTIFY` channels (unrelated to table triggers):

```typescript
@Injectable()
export class CustomEventService implements OnModuleInit {
  constructor(private readonly pgPubSubService: PgPubSubService) {}

  async onModuleInit(): Promise<void> {
    await this.pgPubSubService.susbcribe<{ action: string }>('my-channel', (payload) => {
      console.log(payload.action)
    })
  }
}
```
