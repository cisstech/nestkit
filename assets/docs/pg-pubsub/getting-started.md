# @cisstech/nestjs-pg-pubsub

<div align="center">

A NestJS module for real-time PostgreSQL notifications using PubSub

[![CI](https://github.com/cisstech/nestkit/actions/workflows/ci.yml/badge.svg)](https://github.com/cisstech/nestkit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/cisstech/nestkit/branch/main/graph/badge.svg)](https://codecov.io/gh/cisstech/nestkit)
[![codefactor](https://www.codefactor.io/repository/github/cisstech/nestkit/badge/main)](https://www.codefactor.io/repository/github/cisstech/nestkit/overview/main)
[![GitHub Tag](https://img.shields.io/github/tag/cisstech/nestkit.svg)](https://github.com/cisstech/nestkit/tags)
[![npm package](https://img.shields.io/npm/v/@cisstech/nestjs-pg-pubsub.svg)](https://www.npmjs.org/package/@cisstech/nestjs-pg-pubsub)
[![NPM downloads](http://img.shields.io/npm/dm/@cisstech/nestjs-pg-pubsub.svg)](https://npmjs.org/package/@cisstech/nestjs-pg-pubsub)
[![licence](https://img.shields.io/github/license/cisstech/nestkit)](https://github.com/cisstech/nestkit/blob/main/LICENSE)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

</div>

## Overview

The NestJS PG-PubSub library is a powerful tool that facilitates real-time communication between your NestJS application and PostgreSQL database using the native PostgreSQL Pub/Sub mechanism. It allows your application to listen for changes on specific database tables and respond to those changes in real-time, making it ideal for building reactive applications with immediate data synchronization and event-driven workflows.

**Important Note:** PostgreSQL notifications are transient. If your NestJS application (or a listener) is not actively connected and listening _at the precise moment_ a notification is sent, the notification is missed and lost. Ensure your application instances are running and listening for reliable real-time updates.

## Features

- **Real-Time Table Change Detection**: Automatically listen for INSERT, UPDATE, and DELETE events on PostgreSQL tables
- **Decorator-Based Configuration**: Use intuitive decorators to register table change listeners
- **Automatic Trigger Management**: Dynamically creates and manages PostgreSQL triggers
- **Event Buffering and Batching**: Optimizes performance by buffering and batching events
- **Entity Mapping**: Maps database column names to entity property names automatically
- **Configurable Locking Mechanism**: Built-in locking system with configurable implementation, designed for \*\*handling concurrent processing by multiple subscribers in distributed environments.
- **Custom Event Support**: Subscribe to and handle custom PostgreSQL notification events
- **Suspend/Resume Capability**: Control when the listeners should be active
- **Pub/Sub Architecture & Multiple Subscribers**: Leverages PostgreSQL's native Pub/Sub to allow **multiple instances of your application (or different services) to subscribe to the same database events.** This enables scalability and distribution of real-time event processing.

## Technical Details

- The library creates PostgreSQL triggers and notification functions for the specified tables
- When table data changes, the triggers fire and send notifications through PostgreSQL's NOTIFY mechanism
- The library listens for these notifications and processes them according to your defined listeners
- Events are buffered and batched for efficient processing
- Entity mapping ensures that database column names are correctly mapped to your entity property names
- Locking prevents duplicate processing of events in distributed environments

## Additional Resources

For more information about PostgreSQL's LISTEN/NOTIFY mechanism:

- [PostgreSQL Documentation on NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL Documentation on LISTEN](https://www.postgresql.org/docs/current/sql-listen.html)

## License

MIT © [Mamadou Cisse](https://github.com/cisstech)
