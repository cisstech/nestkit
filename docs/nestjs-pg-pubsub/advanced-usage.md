# Advanced Usage

## Configuration Reference

All options except `databaseUrl` are optional.

```typescript
PgPubSubModule.forRoot({
  databaseUrl: process.env.DATABASE_URL,

  ssl: { rejectUnauthorized: true, ca: '...' },

  triggerPrefix: 'my_prefix', // default: 'pubsub_trigger'
  triggerSchema: 'myschema', // default: 'public'

  fallbackPollingInterval: 60_000, // ms, safety-net polling interval
  lockDuration: 5_000, // ms, advisory lock duration for DDL setup

  pool: {
    max: 5, // dedicated pg.Pool connections (independent of TypeORM)
  },

  queue: {
    table: 'pg_pubsub_queue',
    batchSize: 100, // max messages per pull cycle
    drainInterval: 50, // ms, pause between drain loop iterations
    processingTimeout: 300_000, // ms, after this 'processing' messages are considered orphaned
    maxRetries: 5,
    messageTTL: 86_400_000, // ms, cleanup threshold for old messages (24h)
    cleanupInterval: 3_600_000, // ms, how often the cleanup job runs (1h)
  },
})
```

### Key Options Explained

**`triggerPrefix`**: All triggers created by the library are named `{triggerPrefix}_{table_name}`. On startup, triggers matching this prefix that are no longer needed are dropped. Choose a unique prefix per module if you use multiple `PgPubSubModule.forRoot()` registrations.

**`queue.drainInterval`**: After processing a batch, the drain loop waits this long before fetching the next batch. Prevents tight-looping that could saturate the database under high throughput. Set to `0` to disable.

**`queue.processingTimeout`**: Messages are moved to `processing` while being handled. If a message stays in `processing` longer than this timeout (e.g., the process crashed), it is considered orphaned and reset to `pending` on the next startup. Must be longer than your slowest listener.

**`pool.max`**: The library uses its own `pg.Pool` for all SQL operations (queue reads, advisory locks, trigger DDL). This pool is completely independent of TypeORM's pool, ensuring pg-pubsub keeps working even when TypeORM's pool is exhausted.

## Transaction Management

By default, listeners run without a transaction: you handle errors granularly via `ctx.onError`. For listeners that need atomicity (e.g., writing to multiple tables), the library supports wrapping the entire listener execution in a transaction via an ORM-agnostic adapter.

### 1. Provide a TransactionAdapter

A `TransactionAdapter` opens a transaction, executes a callback, and commits on success or rolls back on failure. Here is a TypeORM example:

```typescript
import { TransactionAdapter } from '@cisstech/nestjs-pg-pubsub'
import { DataSource, EntityManager } from 'typeorm'

export class TypeOrmTransactionAdapter implements TransactionAdapter<EntityManager> {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(callback: (em: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(callback)
  }
}
```

Register it in the module config:

```typescript
PgPubSubModule.forRoot({
  databaseUrl: process.env.DATABASE_URL,
  transactionAdapter: new TypeOrmTransactionAdapter(dataSource),
})
```

The adapter is ORM-agnostic. `TToken` can be anything: a Prisma `$transaction` client, a Knex transaction, etc.

### 2. Mark Listeners as Transactional

Add `transactional: true` to the decorator options:

```typescript
@Injectable()
@RegisterPgTableChangeListener(Order, { transactional: true })
export class OrderChangeListener implements PgTableChangeListener<Order, EntityManager> {
  async process(changes: PgTableChanges<Order>, ctx: PgTableChangeContext<EntityManager>): Promise<void> {
    const em = ctx.transaction! // EntityManager bound to the active transaction

    for (const insert of changes.INSERT) {
      await em.getRepository(AuditLog).save({
        action: 'ORDER_CREATED',
        orderId: insert.data.id,
      })
    }
  }
}
```

### How It Works

- The library calls `transactionAdapter.run()` around your `process()` method
- `ctx.transaction` receives the opaque token (e.g., `EntityManager`) from the adapter
- On success, the transaction commits and messages are marked as processed
- On failure (thrown error), the transaction rolls back and **all** message IDs in the batch are marked as failed for retry
- `ctx.onError` is a no-op in transactional mode. To signal failure, throw an exception instead

### Boot Validation

If any listener has `transactional: true` but no `transactionAdapter` is provided in the config, the application fails to start with a clear error message. This prevents silent misconfiguration.

### Concurrency

Listener executions are bounded by a semaphore (default: 5 concurrent). Configure it with `queue.concurrency`:

```typescript
PgPubSubModule.forRoot({
  databaseUrl: process.env.DATABASE_URL,
  queue: {
    concurrency: 10, // max parallel listener executions
  },
})
```

This applies to both transactional and non-transactional listeners.

## Controlling the Listener at Runtime

### Pause / Resume

```typescript
await this.pgPubSubService.pause() // stop listening, stop processing notifications
await this.pgPubSubService.resume() // reconnect and start listening again
```

Messages inserted while paused accumulate in the queue and are processed on resume.

### Suspend and Run

Pause, execute a callback, resume (even if the callback throws):

```typescript
await this.pgPubSubService.suspendAndRun(async () => {
  await this.runMigrations()
})
```

### Disable Triggers for Specific Operations

When performing bulk operations (cascade deletes, data migrations), suppress trigger notifications with `withTriggersDisabled`. This sets `SET LOCAL pg_pubsub.disabled = 'true'` and only affects the current transaction. Other sessions are not impacted.

```typescript
// TypeORM variant: provides an EntityManager
await this.pgPubSubService.withTriggersDisabled(async (em) => {
  await em.getRepository(Customer).delete(customerId)
})

// Raw SQL variant: uses the dedicated pg pool
await this.pgPubSubService.withTriggersDisabledRaw(async (query) => {
  await query('DELETE FROM orders WHERE customer_id = $1', [customerId])
  await query('DELETE FROM customers WHERE id = $1', [customerId])
})
```
