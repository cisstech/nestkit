---
title: Expander
description: Decorator function to mark a class as a standard expander for a specific DTO.
---
# Expander

`function`

Decorator function to mark a class as a standard expander for a specific DTO.

## Signature

```typescript
function Expander(target: Function): CustomDecorator<typeof EXPANDER_KEY>
```

### Parameters

- `target` (`Function`) - The DTO class this expander is responsible for.

### Returns

`CustomDecorator<typeof EXPANDER_KEY>`
