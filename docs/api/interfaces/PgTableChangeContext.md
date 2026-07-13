---
title: PgTableChangeContext
description: Context passed to a listener's `process` method.
---
# PgTableChangeContext

`interface`

Context passed to a listener's `process` method.

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `onError` | `PgTableChangeErrorHandler` | Callback to signal specific message IDs as failed (non-transactional mode). |
| `transaction?` | `TToken` | Opaque transaction token. Present only when `transactional: true` and a transactionAdapter is configured. |
