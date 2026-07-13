---
title: ListenerDiscovery
description: Result of discovering and processing table change listeners.
---
# ListenerDiscovery

`interface`

Result of discovering and processing table change listeners.

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `columnNameToPropNames` | `Record<string, Map<string, string>>` | Column name to property name mapping for each table. |
| `entityMetadataList` | `EntityMetadata[]` | List of entity metadata. |
| `listeners` | `TableListener[]` | Table listeners. |
| `listenersMap` | `Record<string, ResolvedListener<unknown>[]>` | Map of resolved listeners by table name. |
| `propNameToColumnNames` | `Record<string, Map<string, string>>` | Property name to column name mapping for each table. |
| `tableNames` | `string[]` | List of table names with listeners. |
| `tablesMap` | `Record<string, EntityMetadata>` | Table metadata mapped by table name. |
