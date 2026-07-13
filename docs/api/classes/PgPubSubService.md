---
title: PgPubSubService
description: Subscribes to PostgreSQL pub/sub triggers and handles table changes.
---
# PgPubSubService

`class`

Subscribes to PostgreSQL pub/sub triggers and handles table changes.

## `onModuleDestroy()`

## Signature

```typescript
onModuleDestroy(): Promise<void>
```

### Returns

`Promise<void>`

## `onModuleInit()`

## Signature

```typescript
onModuleInit(): Promise<void>
```

### Returns

`Promise<void>`

## `pause()`

## Signature

```typescript
pause(): Promise<void>
```

### Returns

`Promise<void>`

## `resume()`

## Signature

```typescript
resume(): Promise<void>
```

### Returns

`Promise<void>`

## `susbcribe()`

## Signature

```typescript
susbcribe(channel: string, callback: (payload: T) => void): Promise<void>
```

### Parameters

- `channel` (`string`)
- `callback` (`(payload: T) => void`)

### Returns

`Promise<void>`

## `suspendAndRun()`

## Signature

```typescript
suspendAndRun(action: () => Promise<void>): Promise<void>
```

### Parameters

- `action` (`() => Promise<void>`)

### Returns

`Promise<void>`

## `withTriggersDisabled()`

## Signature

```typescript
withTriggersDisabled(callback: (entityManager: EntityManager) => Promise<T>): Promise<T>
```

### Parameters

- `callback` (`(entityManager: EntityManager) => Promise<T>`)

### Returns

`Promise<T>`

## `withTriggersDisabledRaw()`

## Signature

```typescript
withTriggersDisabledRaw(callback: (query: (sql: string, params: unknown[]) => Promise<R[]>) => Promise<T>): Promise<T>
```

### Parameters

- `callback` (`(query: (sql: string, params: unknown[]) => Promise<R[]>) => Promise<T>`)

### Returns

`Promise<T>`
