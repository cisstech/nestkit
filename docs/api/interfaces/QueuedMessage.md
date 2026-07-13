---
title: QueuedMessage
description: Representation of a message in the queue
---
# QueuedMessage

`interface`

Representation of a message in the queue

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `channel` | `string` |  |
| `created_at` | `Date` |  |
| `id` | `number` |  |
| `next_retry_at` | `Date | null` |  |
| `payload` | `T` |  |
| `processed_at` | `Date | null` |  |
| `retry_count` | `number` |  |
| `status` | `MessageStatus` |  |
