---
title: ExpandErrorPolicy
description: Error policy for expansion errors.
---
# ExpandErrorPolicy

`type`

Error policy for expansion errors.
- 'ignore': Ignore errors and continue with the expansion (default)
- 'include': Include error details in the response
- 'throw': Throw the error and interrupt the entire request

```typescript
type ExpandErrorPolicy = "ignore" | "include" | "throw"
```
