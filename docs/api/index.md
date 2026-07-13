# API reference

Generated from the source. Every export, grouped by kind.

## Functions

- [Expandable](/docs/api/functions/Expandable) - Decorator controller/expander method as expandable (for recursive expansion).
- [Expander](/docs/api/functions/Expander) - Decorator function to mark a class as a standard expander for a specific DTO.
- [ExpanderMethods](/docs/api/functions/ExpanderMethods) - Decorator function to mark a class as containing reusable expansion methods.
- [RegisterPgTableChangeListener](/docs/api/functions/RegisterPgTableChangeListener) - Decorator to register a PostgreSQL table change listener.
- [Selectable](/docs/api/functions/Selectable) - Decorator function to mark a controller endpoint response as selectable.
- [UseExpansionMethod](/docs/api/functions/UseExpansionMethod) - Decorator function to link a field in an

## Classes

- [NestKitExpandModule](/docs/api/classes/NestKitExpandModule)
- [PgLockService](/docs/api/classes/PgLockService) - PostgreSQL advisory lock service.
- [PgPubSubModule](/docs/api/classes/PgPubSubModule)
- [PgPubSubService](/docs/api/classes/PgPubSubService) - Subscribes to PostgreSQL pub/sub triggers and handles table changes.

## Interfaces

- [ListenerDiscovery](/docs/api/interfaces/ListenerDiscovery) - Result of discovering and processing table change listeners.
- [LockOptions](/docs/api/interfaces/LockOptions) - Options for acquiring an advisory lock.
- [PgTableChangeContext](/docs/api/interfaces/PgTableChangeContext) - Context passed to a listener's `process` method.
- [PgTableChangeListener](/docs/api/interfaces/PgTableChangeListener) - Type for a handler that listens to changes on a PostgreSQL table.
- [PoolConfig](/docs/api/interfaces/PoolConfig) - Configuration for the dedicated PG connection pool.
- [QueueConfig](/docs/api/interfaces/QueueConfig) - Queue processing configuration
- [QueuedMessage](/docs/api/interfaces/QueuedMessage) - Representation of a message in the queue
- [ResolvedListener](/docs/api/interfaces/ResolvedListener) - A discovered listener with its resolved metadata.
- [TableListener](/docs/api/interfaces/TableListener) - Describes a table and the events/fields a listener is interested in.
- [TransactionAdapter](/docs/api/interfaces/TransactionAdapter) - ORM-agnostic adapter for running listener logic inside a transaction.
- [TriggerMetadata](/docs/api/interfaces/TriggerMetadata) - Metadata describing a PostgreSQL trigger.

## Type aliases

- [DiscoveredPgTableChangeListener](/docs/api/type-aliases/DiscoveredPgTableChangeListener) - Type representing a class discovered with metadata `@RegisterPgTableChangeListener`
- [ExpandableParams](/docs/api/type-aliases/ExpandableParams) - Represents parameters for making a controller/expander response expandable.
- [ExpandConfig](/docs/api/type-aliases/ExpandConfig) - Represents configuration for the ExpandModule.
- [ExpandContext](/docs/api/type-aliases/ExpandContext) - Represents the context in which an expansion is performed.
- [ExpanderMethodsParams](/docs/api/type-aliases/ExpanderMethodsParams) - Parameters for the
- [ExpandErrorPolicy](/docs/api/type-aliases/ExpandErrorPolicy) - Error policy for expansion errors.
- [ExpansionError](/docs/api/type-aliases/ExpansionError) - Represents error metadata for failed expansions.
- [ExpansionErrorFormatter](/docs/api/type-aliases/ExpansionErrorFormatter) - Format function for expansion errors.
- [ExpansionErrorHandlingConfig](/docs/api/type-aliases/ExpansionErrorHandlingConfig) - Error handling configuration for expansions.
- [PgPubSubConfig](/docs/api/type-aliases/PgPubSubConfig) - Configuration for the PostgreSQL pubsub module.
- [PgTableChangeErrorHandler](/docs/api/type-aliases/PgTableChangeErrorHandler) - Type for a callback to handle errors when processing a change.
- [PgTableChangePayload](/docs/api/type-aliases/PgTableChangePayload) - Type for a PostgreSQL table change payload.
- [PgTableChanges](/docs/api/type-aliases/PgTableChanges) - Type for a batch of changes received for a PostgreSQL table.
- [PgTableChangeType](/docs/api/type-aliases/PgTableChangeType) - Type for a PostgreSQL table change type.
- [PgTableDeletePayload](/docs/api/type-aliases/PgTableDeletePayload) - Type for a PostgreSQL table DELETE payload.
- [PgTableInsertPayload](/docs/api/type-aliases/PgTableInsertPayload) - Type for a PostgreSQL table INSERT payload.
- [PgTableUpdatePayload](/docs/api/type-aliases/PgTableUpdatePayload) - Type for a PostgreSQL table UPDATE payload.
- [RegisterPgTableChangeListenerMetadata](/docs/api/type-aliases/RegisterPgTableChangeListenerMetadata)
- [ReusableExpandMethod](/docs/api/type-aliases/ReusableExpandMethod) - Represents a method within a
- [SelectableParams](/docs/api/type-aliases/SelectableParams) - Represents parameters for making a controller response selectable.
- [StandardExpandMethod](/docs/api/type-aliases/StandardExpandMethod) - Represents a standard method on an
- [UseExpansionMethodConfig](/docs/api/type-aliases/UseExpansionMethodConfig) - Configuration for the
- [UseExpansionMethodMetadata](/docs/api/type-aliases/UseExpansionMethodMetadata) - Metadata stored by the

## Variables

- [DEFAULT_EXPAND_CONFIG](/docs/api/variables/DEFAULT_EXPAND_CONFIG)
- [EXPAND_CONFIG](/docs/api/variables/EXPAND_CONFIG) - Injection token for the ExpandConfig.
- [EXPANDABLE_KEY](/docs/api/variables/EXPANDABLE_KEY) - Symbol key for metadata associated with expandable parameters on controller/expander methods.
- [EXPANDER_KEY](/docs/api/variables/EXPANDER_KEY) - Symbol key for metadata associated with expanders.
- [EXPANDER_METHODS_KEY](/docs/api/variables/EXPANDER_METHODS_KEY) - Symbol key for metadata associated with classes containing reusable expander methods.
- [PG_PUBSUB_CONFIG](/docs/api/variables/PG_PUBSUB_CONFIG) - Symbol for the configuration of the PostgreSQL pubsub module.
- [PG_PUBSUB_DRAIN_INTERVAL](/docs/api/variables/PG_PUBSUB_DRAIN_INTERVAL) - Default delay in milliseconds between drain loop iterations.
- [PG_PUBSUB_FALLBACK_POLLING_INTERVAL](/docs/api/variables/PG_PUBSUB_FALLBACK_POLLING_INTERVAL) - Default fallback polling interval in milliseconds.
- [PG_PUBSUB_LOCK_DURATION](/docs/api/variables/PG_PUBSUB_LOCK_DURATION) - Default advisory lock duration in milliseconds.
- [PG_PUBSUB_POOL_MAX](/docs/api/variables/PG_PUBSUB_POOL_MAX) - Default maximum number of connections in the dedicated pool.
- [PG_PUBSUB_QUEUE_BATCH_SIZE](/docs/api/variables/PG_PUBSUB_QUEUE_BATCH_SIZE) - Default batch size for fetching pending messages.
- [PG_PUBSUB_QUEUE_CLEANUP_INTERVAL](/docs/api/variables/PG_PUBSUB_QUEUE_CLEANUP_INTERVAL) - Default cleanup interval in milliseconds.
- [PG_PUBSUB_QUEUE_CONCURRENCY](/docs/api/variables/PG_PUBSUB_QUEUE_CONCURRENCY) - Default maximum number of concurrent listener executions.
- [PG_PUBSUB_QUEUE_MAX_RETRIES](/docs/api/variables/PG_PUBSUB_QUEUE_MAX_RETRIES) - Default max retries for a failed message.
- [PG_PUBSUB_QUEUE_MESSAGE_TTL](/docs/api/variables/PG_PUBSUB_QUEUE_MESSAGE_TTL) - Default message TTL in milliseconds.
- [PG_PUBSUB_QUEUE_PROCESSING_TIMEOUT](/docs/api/variables/PG_PUBSUB_QUEUE_PROCESSING_TIMEOUT) - Default processing timeout in milliseconds.
- [PG_PUBSUB_QUEUE_SCHEMA](/docs/api/variables/PG_PUBSUB_QUEUE_SCHEMA) - Default queue schema.
- [PG_PUBSUB_QUEUE_TABLE](/docs/api/variables/PG_PUBSUB_QUEUE_TABLE) - Default queue table name.
- [PG_PUBSUB_TRIGGER_NAME](/docs/api/variables/PG_PUBSUB_TRIGGER_NAME) - Trigger channel name and prefix for created triggers.
- [PG_PUBSUB_TRIGGER_SCHEMA](/docs/api/variables/PG_PUBSUB_TRIGGER_SCHEMA) - Default schema for tables and triggers.
- [RegisterPgTableChangeListenerMeta](/docs/api/variables/RegisterPgTableChangeListenerMeta) - Symbol for the metadata key used to register a PostgreSQL table change listener.
- [SELECTABLE_KEY](/docs/api/variables/SELECTABLE_KEY) - Symbol key for metadata associated with selectable parameters.
- [USE_EXPANSION_METHOD_KEY](/docs/api/variables/USE_EXPANSION_METHOD_KEY) - Symbol key for metadata associated with linking reusable expander methods.
