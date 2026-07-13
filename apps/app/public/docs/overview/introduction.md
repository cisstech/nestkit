---
title: Introduction
description: NestKit is a collection of focused modules for NestJS developers.
---

# NestKit

**NestKit** is a small set of focused modules for NestJS APIs. Each one solves a single problem
well and installs on its own, so you add only what you need.

## Packages

| Package | What it gives you |
| --- | --- |
| [@cisstech/nestjs-expand](/docs/nestjs-expand/getting-started) | Dynamic resource expansion: let clients pull related resources on demand, in a single request. |
| [@cisstech/nestjs-pg-pubsub](/docs/nestjs-pg-pubsub/getting-started) | Real-time pub/sub over PostgreSQL `LISTEN`/`NOTIFY`, with no extra message broker to run. |

## Why it exists

Common API needs, like expanding related resources or broadcasting changes, usually pull in heavy
infrastructure or a pile of boilerplate. Each NestKit module keeps the surface small: a NestJS
module you import, sensible defaults, and nothing extra to run that you do not need.

## Where to go next

- Expanding related resources? Start with [nestjs-expand](/docs/nestjs-expand/getting-started).
- Real-time notifications? See [nestjs-pg-pubsub](/docs/nestjs-pg-pubsub/getting-started).
- Source, issues and releases live on [GitHub](https://github.com/cisstech/nestkit).
