# @cisstech/nestjs-pg-pubsub

<div align="center">

A NestJS module for real-time PostgreSQL change data capture using triggers and a persistent queue.

[![CI](https://github.com/cisstech/nestkit/actions/workflows/ci.yml/badge.svg)](https://github.com/cisstech/nestkit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/cisstech/nestkit/branch/main/graph/badge.svg)](https://codecov.io/gh/cisstech/nestkit)
[![codefactor](https://www.codefactor.io/repository/github/cisstech/nestkit/badge/main)](https://www.codefactor.io/repository/github/cisstech/nestkit/overview/main)
[![GitHub Tag](https://img.shields.io/github/tag/cisstech/nestkit.svg)](https://github.com/cisstech/nestkit/tags)
[![npm package](https://img.shields.io/npm/v/@cisstech/nestjs-pg-pubsub.svg)](https://www.npmjs.org/package/@cisstech/nestjs-pg-pubsub)
[![NPM downloads](http://img.shields.io/npm/dm/@cisstech/nestjs-pg-pubsub.svg)](https://npmjs.org/package/@cisstech/nestjs-pg-pubsub)
[![licence](https://img.shields.io/github/license/cisstech/nestkit)](https://github.com/cisstech/nestkit/blob/main/LICENSE)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

</div>

## What It Does

PostgreSQL triggers detect INSERTs, UPDATEs and DELETEs on your tables. Changes are persisted in a queue table, then pulled and dispatched to typed NestJS listeners. No polling-only design, no lost messages, no external broker.

![Diagram](./mermaid.png)

## Why This Exists

PostgreSQL's `LISTEN/NOTIFY` is great for real-time but unreliable: notifications are fire-and-forget, lost during disconnects, and have a payload size limit. This library wraps it with a durable queue so you get both reactivity and guaranteed delivery.

## Key Properties

- **Durable**: changes are persisted in a SQL table before notification, surviving crashes and restarts
- **Reactive**: `LISTEN/NOTIFY` triggers immediate processing, with a fallback poller as safety net
- **Ordered**: messages are processed by ID, in batches, with `SELECT FOR UPDATE SKIP LOCKED`
- **Retry with backoff**: failed messages are retried with exponential backoff ($2^{n}$ minutes)
- **Backpressure**: concurrent notifications are coalesced so that at most one pull cycle runs at a time
- **Isolated pool**: uses its own `pg.Pool`, independent of TypeORM, to avoid pool contention
- **Zero-downtime DDL**: triggers are fingerprinted (MD5) and only recreated when config changes

## Installation

```bash
yarn add @cisstech/nestjs-pg-pubsub pg
```

Supports NestJS v10+ and v11+.

## Quick Start

```typescript
// app.module.ts
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

```typescript
// user-change.listener.ts
@Injectable()
@RegisterPgTableChangeListener(User)
export class UserChangeListener implements PgTableChangeListener<User> {
  async process(changes: PgTableChanges<User>, ctx: PgTableChangeContext): Promise<void> {
    for (const insert of changes.INSERT) {
      console.log(`New user: ${insert.data.email}`)
    }

    for (const update of changes.UPDATE) {
      console.log(`Updated fields: ${update.data.updatedFields.join(', ')}`)
    }
  }
}
```

That's it. The library auto-creates triggers, the queue table, and starts listening.

## How It Works

1. A PostgreSQL trigger fires on table change and inserts a row into `pg_pubsub_queue`
2. The trigger sends a `NOTIFY` with the channel name
3. The library receives the notification and pulls pending messages from the queue
4. Messages are dispatched to the matching `@RegisterPgTableChangeListener` classes
5. Processed messages are marked as such; failed ones are retried with exponential backoff
6. A background poller runs every 60s as a safety net for missed notifications

### Important Constraints

- **Listeners must be fast.** A slow listener delays the entire batch for that table. Offload heavy work to a queue (Bull, etc.) and just enqueue from the listener.
- **Use `TransactionAdapter` for transactional writes.** If a listener needs to write to the DB inside a transaction, configure a `transactionAdapter` and mark the listener with `@RegisterPgTableChangeListener(Entity, { transactional: true })`. The library wraps the listener call in the adapter, passing an opaque transaction token via `ctx.transaction`. Without the adapter, use `ctx.onError` to signal failures.

## Configuration

All options are optional except `databaseUrl`. See the [full configuration reference](https://cisstech.github.io/nestkit/docs/nestjs-pg-pubsub/advanced-usage) for details.

Key tuning knobs:

| Option                    | Default | What it controls                                                      |
| ------------------------- | ------- | --------------------------------------------------------------------- |
| `queue.batchSize`         | 100     | Max messages fetched per pull cycle                                   |
| `queue.drainInterval`     | 50ms    | Pause between drain loop iterations (DB breathing room)               |
| `queue.processingTimeout` | 5min    | After this, a `processing` message is considered orphaned and retried |
| `queue.concurrency`       | 5       | Max listeners executing in parallel per batch                         |
| `transactionAdapter`      | -       | ORM-agnostic adapter for wrapping listeners in transactions           |
| `pool.max`                | 5       | Connections in the dedicated pg-pubsub pool                           |

## Documentation

Full documentation: <https://cisstech.github.io/nestkit/docs/nestjs-pg-pubsub/getting-started>

## License

MIT © [Mamadou Cisse](https://github.com/cisstech)
