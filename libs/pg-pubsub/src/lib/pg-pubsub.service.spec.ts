import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { EventEmitter } from 'events'
import createPostgresSubscriber from 'pg-listen'
import { DataSource } from 'typeorm'
import { ListenerDiscovery, PG_PUBSUB_CONFIG, PgPubSubConfig } from './pg-pubsub'
import { PgPubSubService } from './pg-pubsub.service'
import {
  ListenerDiscoveryService,
  MessageProcessorService,
  PgConnectionPoolService,
  PgLockService,
  PgTriggerService,
  QueueService,
} from './services'

jest.mock('pg-listen', () => ({ __esModule: true, default: jest.fn() }))

const discovery: ListenerDiscovery = {
  tablesMap: {},
  tableNames: [],
  listeners: [],
  listenersMap: {},
  entityMetadataList: [],
  columnNameToPropNames: {},
  propNameToColumnNames: {},
}

const resolvesWithin = (promise: Promise<unknown>, delayMs: number): Promise<boolean> =>
  Promise.race([promise.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), delayMs))])

describe('PgPubSubService', () => {
  let subscriber: {
    events: EventEmitter
    notifications: EventEmitter
    connect: jest.Mock
    listenTo: jest.Mock
    close: jest.Mock
  }
  let messageProcessorService: { pullAndProcessMessages: jest.Mock }

  const createService = async (config: Partial<PgPubSubConfig> = {}): Promise<PgPubSubService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PgPubSubService,
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: { databaseUrl: 'postgres://test', triggerPrefix: 'pg_pubsub', ...config },
        },
        { provide: DataSource, useValue: {} },
        { provide: PgLockService, useValue: { tryLock: jest.fn().mockResolvedValue(undefined) } },
        { provide: PgConnectionPoolService, useValue: {} },
        {
          provide: QueueService,
          useValue: {
            startWorker: jest.fn().mockResolvedValue(undefined),
            stopWorker: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: PgTriggerService, useValue: {} },
        { provide: MessageProcessorService, useValue: messageProcessorService },
        { provide: ListenerDiscoveryService, useValue: { discoverListeners: jest.fn().mockResolvedValue(discovery) } },
      ],
    }).compile()

    return moduleRef.get(PgPubSubService)
  }

  beforeEach(() => {
    subscriber = {
      events: new EventEmitter(),
      notifications: new EventEmitter(),
      connect: jest.fn().mockImplementation(() => {
        setImmediate(() => subscriber.events.emit('connected'))
        return Promise.resolve()
      }),
      listenTo: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }
    ;(createPostgresSubscriber as jest.Mock).mockReturnValue(subscriber)

    // The initial pull never completes, as with a large backlog.
    messageProcessorService = {
      pullAndProcessMessages: jest.fn().mockReturnValue(new Promise<void>(() => undefined)),
    }
  })

  describe('onModuleInit', () => {
    it('should wait for the initial pull to complete by default', async () => {
      const service = await createService()

      const initialized = await resolvesWithin(service.onModuleInit(), 200)
      await service.onModuleDestroy()

      expect(initialized).toBe(false)
      expect(messageProcessorService.pullAndProcessMessages).toHaveBeenCalledWith('pg_pubsub', discovery)
    })

    it('should resolve while the initial pull is running when queue.awaitInitialPull is false', async () => {
      const service = await createService({ queue: { awaitInitialPull: false } })

      const initialized = await resolvesWithin(service.onModuleInit(), 200)
      await service.onModuleDestroy()

      expect(initialized).toBe(true)
      expect(messageProcessorService.pullAndProcessMessages).toHaveBeenCalledWith('pg_pubsub', discovery)
    })

    it('should log a failing initial pull when queue.awaitInitialPull is false', async () => {
      const error = new Error('queue unavailable')
      messageProcessorService.pullAndProcessMessages.mockRejectedValue(error)
      const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const service = await createService({ queue: { awaitInitialPull: false } })

      const initialized = await resolvesWithin(service.onModuleInit(), 200)
      await service.onModuleDestroy()

      expect(initialized).toBe(true)
      expect(loggerError).toHaveBeenCalledWith('Error during initial message pull:', error)
      loggerError.mockRestore()
    })

    it('should listen for notifications while the initial pull is running when queue.awaitInitialPull is false', async () => {
      const service = await createService({ queue: { awaitInitialPull: false } })
      await resolvesWithin(service.onModuleInit(), 200)

      subscriber.notifications.emit('pg_pubsub')
      await service.onModuleDestroy()

      expect(subscriber.listenTo).toHaveBeenCalledWith('pg_pubsub')
      expect(messageProcessorService.pullAndProcessMessages).toHaveBeenCalledTimes(2)
    })
  })
})
