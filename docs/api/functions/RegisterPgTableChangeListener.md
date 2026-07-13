---
title: RegisterPgTableChangeListener
description: Decorator to register a PostgreSQL table change listener.
---
# RegisterPgTableChangeListener

`function`

Decorator to register a PostgreSQL table change listener.

## Signature

```typescript
function RegisterPgTableChangeListener(target: EntityTarget<T>, params?: Omit<RegisterPgTableChangeListenerMetadata<any>, "target">): CustomDecorator<typeof RegisterPgTableChangeListenerMeta>
```

### Parameters

- `target` (`EntityTarget<T>`)
- `params` (`Omit<RegisterPgTableChangeListenerMetadata<any>, "target">`)

### Returns

`CustomDecorator<typeof RegisterPgTableChangeListenerMeta>`
