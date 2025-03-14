/* eslint-disable @typescript-eslint/no-explicit-any */
import { DiscoveryService } from '@golevelup/nestjs-discovery'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { LockService } from './lock'
import { PG_PUBSUB_CONFIG, PG_PUBSUB_LOCK_SERVICE } from './pg-pubsub'
import { PgPubSubService } from './pg-pubsub.service'

describe('PgPubSubService', () => {
  let service: PgPubSubService
  let mockDiscoveryService: Partial<DiscoveryService>
  let mockDataSource: Partial<DataSource>
  let mockLockService: LockService

  beforeEach(async () => {
    mockDiscoveryService = {
      providersWithMetaAtKey: jest.fn().mockResolvedValue([]),
    }

    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
      getMetadata: jest.fn().mockReturnValue({
        tableName: 'test_table',
        columns: [],
        create: jest.fn().mockReturnValue({}),
      }),
    }

    mockLockService = {
      tryLock: jest.fn(async ({ onAccept }) => {
        if (onAccept) {
          await onAccept()
        }
      }),
    }

    const mockConfig = {
      databaseUrl: 'postgresql://user:pass@localhost:5432/testdb',
    }

    const module = await Test.createTestingModule({
      providers: [
        PgPubSubService,
        {
          provide: DiscoveryService,
          useValue: mockDiscoveryService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: mockConfig,
        },
        {
          provide: PG_PUBSUB_LOCK_SERVICE,
          useValue: mockLockService,
        },
      ],
    }).compile()

    service = module.get<PgPubSubService>(PgPubSubService)

    // Mock methods that depend on external services
    jest.spyOn(service as any, 'resume').mockResolvedValue(undefined)
    jest.spyOn(service as any, 'injectPubSubTriggers').mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('onModuleInit', () => {
    it('should discover providers and inject triggers', async () => {
      await service.onModuleInit()

      expect(mockDiscoveryService.providersWithMetaAtKey).toHaveBeenCalled()
      expect((service as any).injectPubSubTriggers).toHaveBeenCalled()
      expect((service as any).resume).toHaveBeenCalled()
    })
  })

  describe('pause and resume', () => {
    it('should close subscription and subscriber when paused', async () => {
      const mockSubscription = {
        unsubscribe: jest.fn(),
      }
      const mockSubscriber = {
        close: jest.fn().mockResolvedValue(undefined),
      }

      // Setup private properties
      Object.defineProperty(service, 'subscription', {
        value: mockSubscription,
        writable: true,
      })
      Object.defineProperty(service, 'subscriber', {
        value: mockSubscriber,
        writable: true,
      })

      await service.pause()

      expect(mockSubscription.unsubscribe).toHaveBeenCalled()
      expect(mockSubscriber.close).toHaveBeenCalled()
      expect((service as any).subscription).toBeUndefined()
      expect((service as any).subscriber).toBeUndefined()
    })
  })

  describe('suspendAndRun', () => {
    it('should pause, run action, and resume', async () => {
      const mockAction = jest.fn().mockResolvedValue(undefined)

      jest.spyOn(service, 'pause').mockResolvedValue(undefined)
      jest.spyOn(service, 'resume').mockResolvedValue(undefined)

      await service.suspendAndRun(mockAction)

      expect(service.pause).toHaveBeenCalled()
      expect(mockAction).toHaveBeenCalled()
      expect(service.resume).toHaveBeenCalled()
    })

    it('should resume even if action throws', async () => {
      const mockError = new Error('Test error')
      const mockAction = jest.fn().mockRejectedValue(mockError)

      jest.spyOn(service, 'pause').mockResolvedValue(undefined)
      jest.spyOn(service, 'resume').mockResolvedValue(undefined)

      await expect(service.suspendAndRun(mockAction)).rejects.toThrow(mockError)

      expect(service.pause).toHaveBeenCalled()
      expect(mockAction).toHaveBeenCalled()
      expect(service.resume).toHaveBeenCalled()
    })
  })
})
