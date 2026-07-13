---
title: PgLockService
description: PostgreSQL advisory lock service.
---
# PgLockService

`class`

PostgreSQL advisory lock service.
Works across multiple processes sharing the same database.

## `onModuleDestroy()`

## Signature

```typescript
onModuleDestroy(): Promise<void>
```

### Returns

`Promise<void>`

## `tryLock()`

## Signature

```typescript
tryLock(options: LockOptions): Promise<void>
```

### Parameters

- `options` (`LockOptions`)

### Returns

`Promise<void>`
