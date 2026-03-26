# Getting Started

## What This Library Does

This library turns PostgreSQL into a reliable change data capture (CDC) system for NestJS. When a row is inserted, updated or deleted in a monitored table, a PostgreSQL trigger persists the change in a queue table and sends a `NOTIFY`. The library picks up that notification, pulls pending messages from the queue, and dispatches them to your typed listener classes.

The result: you get real-time reactivity (via `LISTEN/NOTIFY`) with guaranteed delivery (via the persistent queue). No external broker needed.

## Architecture

```
┌──────────────┐     trigger      ┌──────────────────┐    NOTIFY    ┌──────────────────┐
│  Your Table  │ ──────────────►  │  pg_pubsub_queue │ ──────────►  │  PgPubSubService │
│  (INSERT/    │                  │  (persistent)    │              │  (pull + drain)  │
│   UPDATE/    │                  └──────────────────┘              └────────┬─────────┘
│   DELETE)    │                                                            │
└──────────────┘                                                            ▼
                                                                   ┌──────────────────┐
                                                                   │  Your Listeners  │
                                                                   │  (@Register...)  │
                                                                   └──────────────────┘
```

### Message Lifecycle

1. **Capture**: a trigger fires on the monitored table and inserts a JSON payload into `pg_pubsub_queue` with status `pending`
2. **Notify**: the same trigger sends a `pg_notify` with the channel name
3. **Pull**: the service receives the notification and fetches pending messages with `SELECT FOR UPDATE SKIP LOCKED`
4. **Process**: messages are grouped by table and dispatched to matching listeners
5. **Ack/Fail**: successful messages go to `processed`; failed ones go to `failed` with exponential retry ($2^{n}$ minutes, up to `maxRetries`)
6. **Cleanup**: a background job periodically deletes old processed/dead messages

### Safety Nets

- **Fallback poller**: runs every `fallbackPollingInterval` (default 60s) to catch anything missed by `NOTIFY`
- **Orphan recovery**: on startup, messages stuck in `processing` past their `processingTimeout` are reset to `pending`
- **Backpressure**: concurrent notifications are coalesced so that at most one pull cycle runs at a time
- **Trigger fingerprinting**: trigger DDL is hashed (MD5) and only recreated when config changes

### Important Constraints

- **Do not open transactions inside listeners.** The listener runs inside the drain loop. A slow transaction blocks processing and can cause the `processingTimeout` to expire, leading to orphan recovery and duplicate processing.
- **Keep listeners fast.** If you need heavy work, enqueue to an external job queue (Bull, etc.) from the listener.

## Prerequisites

- NestJS v10+ or v11+
- PostgreSQL database
- TypeORM configured in your application

## Additional Resources

- [PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL LISTEN](https://www.postgresql.org/docs/current/sql-listen.html)

## License

MIT © [Mamadou Cisse](https://github.com/cisstech)
