---
title: Expandable
description: Decorator controller/expander method as expandable (for recursive expansion).
---
# Expandable

`function`

Decorator controller/expander method as expandable (for recursive expansion).
Also used on controller endpoints to enable expansion for the response.

## Signature

```typescript
function Expandable(target: Function, config?: Omit<ExpandableParams, "target">): CustomDecorator<typeof EXPANDABLE_KEY>
```

### Parameters

- `target` (`Function`) - The DTO class returned by the method/endpoint.
- `config` (`Omit<ExpandableParams, "target">`) - Additional configuration for expandable parameters.

### Returns

`CustomDecorator<typeof EXPANDABLE_KEY>`
