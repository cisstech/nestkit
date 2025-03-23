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

## Features

- **Real-Time Table Change Detection**: Automatically listen for INSERT, UPDATE, and DELETE events on PostgreSQL tables
- **Decorator-Based Configuration**: Use intuitive decorators to register table change listeners
- **Automatic Trigger Management**: Dynamically creates and manages PostgreSQL triggers
- **Event Buffering and Batching**: Optimizes performance by buffering and batching events
- **Entity Mapping**: Maps database column names to entity property names automatically
- **Persistent Message Queue**: Messages are stored in a PostgreSQL table to prevent data loss
- **Reactive Processing**: Immediately pulls and processes messages when notifications are received
- **TTL and Retry System**: Implements time-to-live and automatic retries for failed message processing
- **Message Ordering**: Preserves message processing order using row IDs
- **Auto Cleanup**: Automatically removes old processed messages to keep the queue size manageable
- **Multiple Subscribers**: Leverages PostgreSQL's native Pub/Sub to allow multiple application instances to subscribe to the same changes
- **Error Handling**: Provides comprehensive error handling mechanisms
- **Fallback Reliability**: Includes low-frequency background polling to ensure no messages are missed

## Technical Architecture

The library uses a hybrid architecture for optimal performance and reliability:

1. **Trigger-Based Detection**: PostgreSQL triggers capture table changes and store them in a queue table
2. **Notification System**: Immediate notifications with message IDs are sent via PostgreSQL's NOTIFY
3. **Message Queue**: Durable storage of change events in a queue table with status tracking
4. **Hybrid Processing**:
   - Reactive processing triggered by notifications
   - Fallback polling for maximum reliability
5. **Smart Batching**: Messages are processed in efficient batches while preserving order

## Additional Resources

For more information about PostgreSQL's LISTEN/NOTIFY mechanism:

- [PostgreSQL Documentation on NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL Documentation on LISTEN](https://www.postgresql.org/docs/current/sql-listen.html)

## License

MIT © [Mamadou Cisse](https://github.com/cisstech)
