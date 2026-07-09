<!-- markdownlint-disable MD033 -->

<h1 align="center">NestKit</h1>

<div align="center">

A collection of libraries for [NestJS](https://nestjs.com) developers.

[![CI](https://github.com/cisstech/nestkit/actions/workflows/ci.yml/badge.svg)](https://github.com/cisstech/nestkit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/cisstech/nestkit/branch/main/graph/badge.svg)](https://codecov.io/gh/cisstech/nestkit)
[![codefactor](https://www.codefactor.io/repository/github/cisstech/nestkit/badge/main)](https://www.codefactor.io/repository/github/cisstech/nestkit/overview/main)
[![GitHub Tag](https://img.shields.io/github/tag/cisstech/nestkit.svg)](https://github.com/cisstech/nestkit/tags)
[![licence](https://img.shields.io/github/license/cisstech/nestkit)](https://github.com/cisstech/nestkit/blob/main/LICENSE)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

</div>

## Overview

NestKit is a set of focused modules for NestJS APIs. Each package solves one problem well and
installs on its own, so you add only what you need and nothing you do not.

## Packages

| Package | What it does | Version |
| --- | --- | --- |
| [`@cisstech/nestjs-expand`](https://cisstech.github.io/nestkit/docs/nestjs-expand/getting-started) | Dynamic resource expansion: let API clients pull related resources on demand, in a single request. | [![npm](https://img.shields.io/npm/v/@cisstech/nestjs-expand.svg)](https://www.npmjs.com/package/@cisstech/nestjs-expand) |
| [`@cisstech/nestjs-pg-pubsub`](https://cisstech.github.io/nestkit/docs/nestjs-pg-pubsub/getting-started) | Real-time pub/sub over PostgreSQL `LISTEN`/`NOTIFY`, with no extra message broker to run. | [![npm](https://img.shields.io/npm/v/@cisstech/nestjs-pg-pubsub.svg)](https://www.npmjs.com/package/@cisstech/nestjs-pg-pubsub) |

## Compatibility

Both modules support NestJS 10 and 11.

## Documentation

Guides and API for every module are hosted at
[cisstech.github.io/nestkit](https://cisstech.github.io/nestkit/).

## Articles

- [Supercharging NestJS APIs: a deep dive into Dynamic Resource Expansion](https://medium.com/@mciissee/supercharging-nestjs-apis-a-deep-dive-into-dynamic-resource-expansion-0e932cc7b4f2)
- [Building real-time applications with PostgreSQL and NestJS](https://medium.com/@mciissee/building-real-time-applications-with-postgresql-and-nestjs-using-nestjs-pg-pubsub-db724187df3f)

## Development

Clone and install:

```bash
git clone https://github.com/cisstech/nestkit
cd nestkit
yarn
```

The sample application reads its configuration from a `.env` file at the repository root:

```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=your_database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/your_database

# Redis (for the distributed lock service)
REDIS_HOST=localhost
REDIS_PORT=6379
```

Start the services and serve the demo:

```bash
docker-compose up -d
yarn start
```

- The documentation app is served at <http://localhost:4200/>.
- The sample API documentation is served at <http://localhost:3000/api/doc>.

## Contribution

Contributions are always welcome. Please read our
[CONTRIBUTING.md](https://github.com/cisstech/nestkit/blob/main/CONTRIBUTING.md) first, then submit
ideas as [pull requests](https://github.com/cisstech/nestkit/pulls) or
[GitHub issues](https://github.com/cisstech/nestkit/issues). Make sure your code style matches the
rest of the project and that the unit tests and linter pass.

## Support development

NestKit is free to use. As the maintainer, I put a lot of time into answering questions, fixing
issues and adding features around a full-time job. If the project saved you or your team time, a
star on the [repository](https://github.com/cisstech/nestkit) supports its maintenance and future
work.

## License

MIT © [Mamadou Cisse](https://github.com/cisstech)
