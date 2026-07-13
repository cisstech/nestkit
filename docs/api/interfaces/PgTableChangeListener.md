---
title: PgTableChangeListener
description: Type for a handler that listens to changes on a PostgreSQL table.
---
# PgTableChangeListener

`interface`

Type for a handler that listens to changes on a PostgreSQL table.

## `process()`

## Signature

```typescript
process(changes: PgTableChanges<TRow>, ctx: PgTableChangeContext<TToken>): Promise<void>
```

### Parameters

- `changes` (`PgTableChanges<TRow>`) - The batch of changes for the table.
- `ctx` (`PgTableChangeContext<TToken>`) - Context with error handling and optional transaction token.

### Returns

`Promise<void>`
