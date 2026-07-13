---
title: QueueConfig
description: Queue processing configuration
---
# QueueConfig

`interface`

Queue processing configuration

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `batchSize?` | `number` | Maximum number of messages to fetch per pull cycle. |
| `cleanupInterval?` | `number` | Interval in milliseconds to clean up old processed messages |
| `concurrency?` | `number` | Maximum number of listener executions running in parallel. |
| `drainInterval?` | `number` | Delay in milliseconds between drain loop iterations. |
| `maxRetries?` | `number` | Maximum number of retries for a failed message |
| `messageTTL?` | `number` | Time-to-live for messages in milliseconds |
| `processingTimeout?` | `number` | Timeout in milliseconds after which a 'processing' message is considered orphaned. |
| `schema?` | `string` | Name of the queue schema |
| `table?` | `string` | Name of the queue table |
