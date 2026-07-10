# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.15.0](https://github.com/cisstech/nestkit/compare/v1.14.1...v1.15.0) (2026-03-26)

### [1.14.1](https://github.com/cisstech/nestkit/compare/v1.14.0...v1.14.1) (2026-03-26)

### Features

* **pg-pubsub:** add TransactionAdapter, Semaphore concurrency, and harden queue cleanup ([970fd55](https://github.com/cisstech/nestkit/commit/970fd551db831a1a7573f0c58d8bc5257a1bebdb))

## [1.14.0](https://github.com/cisstech/nestkit/compare/v1.13.1...v1.14.0) (2026-02-19)

### Features

* **pg-pubsub:** add withTriggersDisabledRaw for raw SQL support ([d4afa8f](https://github.com/cisstech/nestkit/commit/d4afa8f776d6ecc6068dfbfca6e85aa408b4dd57))

### Bug Fixes

* **pg-pubsub:** validate listener identifiers and fix documentation ([d4d5720](https://github.com/cisstech/nestkit/commit/d4d5720a8198d843f406a8e3a87b121f381cbe91))
* **pg-pubsub:** harden SQL queries and input validation ([a20a85b](https://github.com/cisstech/nestkit/commit/a20a85b5f2318571a458725a7dcdbb71f3c81cce))

### Performance Improvements

* **pg-pubsub:** use dedicated pg pool, add backpressure and optimize triggers ([51fd609](https://github.com/cisstech/nestkit/commit/51fd6093b60d7e976d200af9b8fd02bef06f216b))

### [1.13.1](https://github.com/cisstech/nestkit/compare/v1.13.0...v1.13.1) (2026-01-08)

## [1.13.0](https://github.com/cisstech/nestkit/compare/v1.12.0...v1.13.0) (2025-12-02)

## [1.12.0](https://github.com/cisstech/nestkit/compare/v1.11.0...v1.12.0) (2025-11-15)

### Features

* **pg-pubsub:** enhance documentation for queue metadata and retry handling ([f0cd0fc](https://github.com/cisstech/nestkit/commit/f0cd0fcfef5c9910f0883d1c01e3c415f0651e60))
* **pg-pubsub:** expose queue metadata in change payloads ([859b009](https://github.com/cisstech/nestkit/commit/859b0090a7a713eaae1f7c5dc0d71105bbfc1978))

## [1.11.0](https://github.com/cisstech/nestkit/compare/v1.10.2...v1.11.0) (2025-11-14)

### Bug Fixes

* **pg-pubsub:** use differential trigger updates to prevent event loss ([cde10b0](https://github.com/cisstech/nestkit/commit/cde10b02814918732b5cbff1f69d934ea6d9683e))

### [1.10.2](https://github.com/cisstech/nestkit/compare/v1.10.1...v1.10.2) (2025-11-03)

### Features

* use queue schema to update trigger definition ([b30f8a8](https://github.com/cisstech/nestkit/commit/b30f8a80f1fa9d467d9e2084cd632b281264cab2))
* define PG_PUBSUB_QUEUE_SCHEMA constant ([e7d61f3](https://github.com/cisstech/nestkit/commit/e7d61f32ba4a44f6526a22b6945e0bd7e1b568d1))

### Bug Fixes

* update function name to include schema name ([65b4cd2](https://github.com/cisstech/nestkit/commit/65b4cd2ac8dadd96aec2427da5e7889f92f5478c))
* use default queue name from PG_PUBSUB_QUEUE_TABLE constant ([09d17a9](https://github.com/cisstech/nestkit/commit/09d17a961d233778ee82318178a0528316c52c1e))

### [1.10.1](https://github.com/cisstech/nestkit/compare/v1.10.0...v1.10.1) (2025-11-02)

### Features

* add ssl to pgpubsubconfig type ([de012a9](https://github.com/cisstech/nestkit/commit/de012a93b73f47205e99fdd9e603fc1d82008c7c))

### Bug Fixes

* pass ssl as part of connection config ([27dda10](https://github.com/cisstech/nestkit/commit/27dda10b1736235fe84ffcdb4a967a0f6d1eff59))

## [1.10.0](https://github.com/cisstech/nestkit/compare/v1.9.0...v1.10.0) (2025-04-27)

### Features

* **nestjs-expand:** introduce reusable expand methods ([fc73490](https://github.com/cisstech/nestkit/commit/fc73490663fdc0b966a7b5a33d4cda51fa720eec))

### Bug Fixes

* **nestjs-expand:** peerDependencies ([14a2a7e](https://github.com/cisstech/nestkit/commit/14a2a7e8c7ef3db6f0b5fc0b8e9155e714203d36))

## [1.9.0](https://github.com/cisstech/nestkit/compare/v1.8.0...v1.9.0) (2025-03-23)

### Features

* **nestjs-pg-pubsub:** prevent message loss using queue system ([7f8ffbc](https://github.com/cisstech/nestkit/commit/7f8ffbc5da2338ec50535caecb116f6e133b7569))
* **nestjs-pg-pubsub:**  pg-lock.service ([d6f7c6a](https://github.com/cisstech/nestkit/commit/d6f7c6ae6782a0af78656775b83af347af00fb42))
* **nestjs-pg-pubsub:** make schema name configurable ([d3aef30](https://github.com/cisstech/nestkit/commit/d3aef307c0d6d025676b2395069fce51e38ff85d))
* **nestjs-pg-pubsub:** make trigger name prefix configurable ([188f591](https://github.com/cisstech/nestkit/commit/188f591805712251ea7df9ac2455a1f3f75793d7))

## [1.8.0](https://github.com/cisstech/nestkit/compare/v1.7.0...v1.8.0) (2025-03-14)

### Features

* **nestjs-expand:** custom error handling ([2867a9d](https://github.com/cisstech/nestkit/commit/2867a9d86fef6629f2227db564f59b5f43d08b65))

## [1.7.0](https://github.com/cisstech/nestkit/compare/v1.6.0...v1.7.0) (2025-03-14)

### Features

* **api:** nestjs-pg-pubsub sample ([17318bc](https://github.com/cisstech/nestkit/commit/17318bcbbe7c46316936b847c1f3b65525f061ea))
* **nestjs-pg-pubsub:** v1 ([216e826](https://github.com/cisstech/nestkit/commit/216e826503d1e3867f2cc9e3925cdb359c441424))

## [1.6.0](https://github.com/cisstech/nestkit/compare/v1.5.0...v1.6.0) (2025-02-12)

### Bug Fixes

* **nestjs-expand:** handle errors during expansion ([dc337e7](https://github.com/cisstech/nestkit/commit/dc337e78111fde7bf8de0c92913d7fceaea18f72))

## [1.5.0](https://github.com/cisstech/nestkit/compare/v1.4.0...v1.5.0) (2024-08-27)

## [1.4.0](https://github.com/cisstech/nestkit/compare/v1.3.0...v1.4.0) (2024-07-20)

### Bug Fixes

* **nestjs-expand:** not working with controllers using res.json ([2774cdb](https://github.com/cisstech/nestkit/commit/2774cdbbcec7a5e8ad7b699dd8ff5a26e0817818))
* **nestjs-expand:** nullable fields are not selected ([6594f59](https://github.com/cisstech/nestkit/commit/6594f590930d30809a39f5191ad66943a2aaca39))

## [1.3.0](https://github.com/cisstech/nestkit/compare/v1.2.1...v1.3.0) (2024-03-21)

### Features

* **nestjs-expand:** support array, nullable props selection ([efccd77](https://github.com/cisstech/nestkit/commit/efccd776dafe03215531382ede8439bf0e96b106))

### Bug Fixes

* **nestjs-expand:** props with false values ignored during selection ([a98f2e0](https://github.com/cisstech/nestkit/commit/a98f2e0375297ef63135eac5fc44fb13f580da60))

### [1.2.1](https://github.com/cisstech/nestkit/compare/v1.2.0...v1.2.1) (2024-03-04)

### Bug Fixes

* expand service should work event if query is undefined ([5e2dbae](https://github.com/cisstech/nestkit/commit/5e2dbaed680542e27cbbde9a73783844b28a5c1f))

## [1.2.0](https://github.com/cisstech/nestkit/compare/v1.1.0...v1.2.0) (2024-02-05)

### Features

* **expand:** multiple expanders on same dto ([cf82957](https://github.com/cisstech/nestkit/commit/cf82957a17630a8ffaf2dc2d1a9e4985c9f0a3cb))

## [1.1.0](https://github.com/cisstech/nestkit/compare/v1.0.3...v1.1.0) (2024-02-05)

### [1.0.3](https://github.com/cisstech/nestkit/compare/v1.0.2...v1.0.3) (2023-12-09)

### Bug Fixes

* **expand:** Selectable decorator metadata config ([b882b6e](https://github.com/cisstech/nestkit/commit/b882b6efaf26e94a4d5100f2538e30dcec3386cc))

### [1.0.2](https://github.com/cisstech/nestkit/compare/v1.0.1...v1.0.2) (2023-12-09)

### [1.0.1](https://github.com/cisstech/nestkit/compare/v1.0.0...v1.0.1) (2023-11-30)

### Bug Fixes

* **expand:** handle controller null response ([e5bc007](https://github.com/cisstech/nestkit/commit/e5bc007a703d23fa6dad75a579ccc5a73529e90b))

## 1.0.0 (2023-11-25)

### Features

* **expand:** support comma separated queries ([b515373](https://github.com/cisstech/nestkit/commit/b51537399a22f68c8fce376440279df358199f14))
* **expand:** add selection feature ([00e3214](https://github.com/cisstech/nestkit/commit/00e321436ffc4ad882c5131b0aaa74899f9b8a0e))
* **api:** add expand sample api ([3363831](https://github.com/cisstech/nestkit/commit/3363831d4980893e3c0466384fb99d9bccd0ac90))
* **expand:** add expandQueryParamName config ([74f49c8](https://github.com/cisstech/nestkit/commit/74f49c80e1dc5a7ffdae15f3bb637115a663efdb))
* add nest-expand ([ac9c102](https://github.com/cisstech/nestkit/commit/ac9c1024b0e1e730f66bab017d77f4e6b37e2089))

### Bug Fixes

* github page setup ([d960667](https://github.com/cisstech/nestkit/commit/d960667b2052387a95edf913e8d5f56dd795d23f))

