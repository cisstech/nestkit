---
title: PgTableChangePayload
description: Type for a PostgreSQL table change payload.
---
# PgTableChangePayload

`type`

Type for a PostgreSQL table change payload.

```typescript
type PgTableChangePayload = PgTableInsertPayload<TRow> | PgTableDeletePayload<TRow> | PgTableUpdatePayload<TRow>
```
