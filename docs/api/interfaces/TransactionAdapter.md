---
title: TransactionAdapter
description: ORM-agnostic adapter for running listener logic inside a transaction.
---
# TransactionAdapter

`interface`

ORM-agnostic adapter for running listener logic inside a transaction.
TToken is opaque to the library (e.g. EntityManager for TypeORM, PrismaClient for Prisma).

## `run()`

## Signature

```typescript
run(callback: (token: TToken) => Promise<T>): Promise<T>
```

### Parameters

- `callback` (`(token: TToken) => Promise<T>`)

### Returns

`Promise<T>`
