---
title: TableListener
description: Describes a table and the events/fields a listener is interested in.
---
# TableListener

`interface`

Describes a table and the events/fields a listener is interested in.

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `events?` | `("INSERT" | "DELETE" | "UPDATE")[]` |  |
| `payloadFields?` | `string[]` |  |
| `schema` | `string` |  |
| `table` | `string` |  |
