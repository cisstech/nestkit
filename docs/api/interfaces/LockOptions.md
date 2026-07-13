---
title: LockOptions
description: Options for acquiring an advisory lock.
---
# LockOptions

`interface`

Options for acquiring an advisory lock.

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `duration` | `number` | Duration of the lock in milliseconds. |
| `key` | `string` | Key to lock on. |
| `onAccept` | `() => void | Promise<void>` | Callback executed when the lock is acquired. |
| `onReject?` | `(error: unknown) => void | Promise<void>` | Optional callback executed when the lock is rejected. |
