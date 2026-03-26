/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test } from '@nestjs/testing'
import {
  ListenerDiscovery,
  PG_PUBSUB_CONFIG,
  PgTableChangeContext,
  PgTableChangeListener,
  PgTableInsertPayload,
  ResolvedListener,
} from '../pg-pubsub'
import { MessageProcessorService } from './message-processor.service'
import { QueueService } from './queue.service'

const createListenerDiscovery = (patch: Partial<ListenerDiscovery> = {}): ListenerDiscovery => ({
  tablesMap: {},
  tableNames: [],
  listeners: [],
  listenersMap: {},
  entityMetadataList: [],
  columnNameToPropNames: {},
  propNameToColumnNames: {},
  ...patch,
})

describe('MessageProcessorService', () => {
  let messageProcessorService: MessageProcessorService
  let queueService: {
    fetchPendingMessages: jest.Mock
    markAsProcessed: jest.Mock
    markAsFailed: jest.Mock
  }

  beforeEach(async () => {
    queueService = {
      fetchPendingMessages: jest.fn(),
      markAsProcessed: jest.fn(),
      markAsFailed: jest.fn(),
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessageProcessorService,
        {
          provide: QueueService,
          useValue: queueService,
        },
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: { queue: { drainInterval: 0 } },
        },
      ],
    }).compile()

    messageProcessorService = moduleRef.get<MessageProcessorService>(MessageProcessorService)
  })

  describe('pullAndProcessMessages', () => {
    it('should process messages from the queue', async () => {
      const mockMessages = [
        {
          id: 1,
          payload: {
            id: 1,
            event: 'INSERT',
            table: 'users',
            data: { name: 'Test User' },
          } as PgTableInsertPayload,
        },
      ]

      const mockDiscovery = createListenerDiscovery({
        tablesMap: {
          users: { create: () => ({}) } as any,
        },
        columnNameToPropNames: {
          users: new Map([['name', 'name']]),
        },
        listenersMap: {
          users: [] as ResolvedListener<unknown>[],
        },
        tableNames: ['users'],
      })

      // Mock queue service to return messages, then empty on drain
      queueService.fetchPendingMessages.mockResolvedValueOnce(mockMessages).mockResolvedValueOnce([])

      await messageProcessorService.pullAndProcessMessages('test_channel', mockDiscovery)

      // Verify messages were processed
      expect(queueService.fetchPendingMessages).toHaveBeenCalledWith('test_channel')
      expect(queueService.fetchPendingMessages).toHaveBeenCalledTimes(2)
      expect(queueService.markAsProcessed).toHaveBeenCalledWith([1])
    })

    it('should handle errors during message processing', async () => {
      const mockMessages = [
        {
          id: 1,
          payload: {
            id: 1,
            event: 'INSERT',
            table: 'unknown_table', // Table that doesn't exist in discovery
            data: { name: 'Test User' },
          } as PgTableInsertPayload,
        },
      ]

      // Mock discovery with empty table maps
      const mockDiscovery = createListenerDiscovery()

      // Mock queue service to return messages
      queueService.fetchPendingMessages.mockResolvedValueOnce(mockMessages).mockResolvedValueOnce([])

      await messageProcessorService.pullAndProcessMessages('test_channel', mockDiscovery)

      // Verify failed message was marked accordingly
      expect(queueService.markAsFailed).toHaveBeenCalledWith([1])
    })

    it('should do nothing if no messages are found', async () => {
      queueService.fetchPendingMessages.mockResolvedValue([])

      const mockDiscovery = createListenerDiscovery()

      await messageProcessorService.pullAndProcessMessages('test_channel', mockDiscovery)

      // Verify no processing was attempted
      expect(queueService.markAsProcessed).not.toHaveBeenCalled()
      expect(queueService.markAsFailed).not.toHaveBeenCalled()
    })
  })

  describe('processChanges', () => {
    it('should route changes to appropriate listeners', async () => {
      // Create mock changes
      const changes = [
        {
          id: 1,
          event: 'INSERT' as const,
          table: 'users',
          data: { name: 'Test User' },
        },
        {
          id: 2,
          event: 'INSERT' as const,
          table: 'roles',
          data: { name: 'Admin' },
        },
      ]

      // Create mock listeners
      const usersListener: PgTableChangeListener<unknown> = {
        process: jest.fn().mockResolvedValue(undefined),
      }

      const rolesListener: PgTableChangeListener<unknown> = {
        process: jest.fn().mockResolvedValue(undefined),
      }

      const listenersMap: Record<string, ResolvedListener<unknown>[]> = {
        users: [{ instance: usersListener, transactional: false }],
        roles: [{ instance: rolesListener, transactional: false }],
      }

      await messageProcessorService['processChanges'](changes, listenersMap)

      // Verify listeners were called with appropriate changes
      expect(usersListener.process).toHaveBeenCalledWith(
        expect.objectContaining({
          all: expect.arrayContaining([changes[0]]),
          INSERT: expect.arrayContaining([changes[0]]),
        }),
        expect.objectContaining({ onError: expect.any(Function) })
      )

      expect(rolesListener.process).toHaveBeenCalledWith(
        expect.objectContaining({
          all: expect.arrayContaining([changes[1]]),
          INSERT: expect.arrayContaining([changes[1]]),
        }),
        expect.objectContaining({ onError: expect.any(Function) })
      )
    })

    it('should handle errors when listeners throw exceptions', async () => {
      // Create mock changes
      const changes = [
        {
          id: 1,
          event: 'INSERT' as const,
          table: 'users',
          data: { name: 'Test User' },
        },
      ]

      // Create mock listener that fails
      const usersListener: PgTableChangeListener<unknown> = {
        process: jest.fn().mockRejectedValue(new Error('Processing failed')),
      }

      const listenersMap: Record<string, ResolvedListener<unknown>[]> = {
        users: [{ instance: usersListener, transactional: false }],
      }

      await messageProcessorService['processChanges'](changes, listenersMap)

      // Verify listener was called and message IDs were marked as failed
      expect(usersListener.process).toHaveBeenCalled()
      expect(queueService.markAsFailed).toHaveBeenCalledWith([1])
      expect(queueService.markAsProcessed).toHaveBeenCalledWith([])
    })

    it('should group changes by table', async () => {
      // Create mock changes for the same table
      const changes = [
        {
          id: 1,
          event: 'INSERT' as const,
          table: 'users',
          data: { name: 'User 1' },
        },
        {
          id: 2,
          event: 'INSERT' as const,
          table: 'users',
          data: { name: 'User 2' },
        },
      ]

      // Create mock listener
      const usersListener: PgTableChangeListener<unknown> = {
        process: jest.fn().mockResolvedValue(undefined),
      }

      const listenersMap: Record<string, ResolvedListener<unknown>[]> = {
        users: [{ instance: usersListener, transactional: false }],
      }

      await messageProcessorService['processChanges'](changes, listenersMap)

      // Verify listener was called once with both changes
      expect(usersListener.process).toHaveBeenCalledTimes(1)
      expect(usersListener.process).toHaveBeenCalledWith(
        expect.objectContaining({
          all: expect.arrayContaining([changes[0], changes[1]]),
          INSERT: expect.arrayContaining([changes[0], changes[1]]),
        }),
        expect.objectContaining({ onError: expect.any(Function) })
      )
    })

    it('should wrap transactional listeners with the transaction adapter', async () => {
      const changes = [
        {
          id: 1,
          event: 'INSERT' as const,
          table: 'users',
          data: { name: 'Test User' },
        },
      ]

      const fakeToken = { fake: 'entityManager' }
      const usersListener: PgTableChangeListener<unknown> = {
        process: jest.fn().mockResolvedValue(undefined),
      }

      const listenersMap: Record<string, ResolvedListener<unknown>[]> = {
        users: [{ instance: usersListener, transactional: true }],
      }

      // Inject a transaction adapter
      ;(messageProcessorService as any).transactionAdapter = {
        run: jest.fn().mockImplementation(async (cb: any) => cb(fakeToken)),
      }

      await messageProcessorService['processChanges'](changes, listenersMap)

      expect(usersListener.process).toHaveBeenCalledWith(
        expect.objectContaining({ all: expect.arrayContaining([changes[0]]) }),
        expect.objectContaining({ transaction: fakeToken })
      )
    })

    it('should mark all messages as failed when transactional listener throws', async () => {
      const changes = [
        { id: 1, event: 'INSERT' as const, table: 'users', data: {} },
        { id: 2, event: 'INSERT' as const, table: 'users', data: {} },
      ]

      const usersListener: PgTableChangeListener<unknown> = {
        process: jest.fn().mockRejectedValue(new Error('tx failed')),
      }

      const listenersMap: Record<string, ResolvedListener<unknown>[]> = {
        users: [{ instance: usersListener, transactional: true }],
      }

      ;(messageProcessorService as any).transactionAdapter = {
        run: jest.fn().mockImplementation(async (cb: any) => cb({})),
      }

      await messageProcessorService['processChanges'](changes, listenersMap)

      expect(queueService.markAsFailed).toHaveBeenCalledWith([1, 2])
      expect(queueService.markAsProcessed).toHaveBeenCalledWith([])
    })

    it('should respect concurrency limit', async () => {
      let concurrent = 0
      let maxConcurrent = 0

      const slowListener: PgTableChangeListener<unknown> = {
        process: jest.fn().mockImplementation(async () => {
          concurrent++
          maxConcurrent = Math.max(maxConcurrent, concurrent)
          await new Promise((r) => setTimeout(r, 10))
          concurrent--
        }),
      }

      // 3 tables, each with 1 listener, concurrency = 2
      const changes = [
        { id: 1, event: 'INSERT' as const, table: 'a', data: {} },
        { id: 2, event: 'INSERT' as const, table: 'b', data: {} },
        { id: 3, event: 'INSERT' as const, table: 'c', data: {} },
      ]

      const listenersMap: Record<string, ResolvedListener<unknown>[]> = {
        a: [{ instance: slowListener, transactional: false }],
        b: [{ instance: slowListener, transactional: false }],
        c: [{ instance: slowListener, transactional: false }],
      }

      // Replace semaphore with concurrency 2
      ;(messageProcessorService as any).semaphore = new (require('../semaphore').Semaphore)(2)

      await messageProcessorService['processChanges'](changes, listenersMap)

      expect(maxConcurrent).toBeLessThanOrEqual(2)
      expect(slowListener.process).toHaveBeenCalledTimes(3)
    })
  })

  describe('backpressure (semaphore + coalescing)', () => {
    it('should coalesce concurrent pull requests into a single re-fetch', async () => {
      let fetchCount = 0
      let resolveFirstFetch: (() => void) | undefined

      // First fetch blocks until we release it; second fetch returns empty
      queueService.fetchPendingMessages.mockImplementation(() => {
        fetchCount++
        if (fetchCount === 1) {
          return new Promise<any[]>((resolve) => {
            resolveFirstFetch = () => resolve([])
          })
        }
        return Promise.resolve([])
      })

      const mockDiscovery = createListenerDiscovery()

      // Fire 3 concurrent pulls
      const p1 = messageProcessorService.pullAndProcessMessages('ch', mockDiscovery)
      const p2 = messageProcessorService.pullAndProcessMessages('ch', mockDiscovery)
      const p3 = messageProcessorService.pullAndProcessMessages('ch', mockDiscovery)

      // p2 and p3 should return immediately (coalesced)
      await p2
      await p3

      // Release the first fetch
      resolveFirstFetch?.()
      await p1

      // Should have been called exactly 2 times:
      // 1st = the initial pull, 2nd = the coalesced re-fetch
      expect(queueService.fetchPendingMessages).toHaveBeenCalledTimes(2)
    })

    it('should not re-fetch when no pull was requested during processing', async () => {
      queueService.fetchPendingMessages.mockResolvedValue([])
      const mockDiscovery = createListenerDiscovery()

      await messageProcessorService.pullAndProcessMessages('ch', mockDiscovery)

      // Only 1 fetch, no coalesced re-fetch needed
      expect(queueService.fetchPendingMessages).toHaveBeenCalledTimes(1)
    })
  })
})
