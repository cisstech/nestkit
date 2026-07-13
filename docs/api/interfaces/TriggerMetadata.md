---
title: TriggerMetadata
description: Metadata describing a PostgreSQL trigger.
---
# TriggerMetadata

`interface`

Metadata describing a PostgreSQL trigger.

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `events?` | `("INSERT" | "DELETE" | "UPDATE")[]` |  |
| `hash?` | `string` |  |
| `name` | `string` |  |
| `payloadFields?` | `string[]` |  |
| `schema` | `string` |  |
| `table` | `string` |  |
