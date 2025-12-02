/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test } from '@nestjs/testing'
import { PgTableChangeListener, PgTableInsertPayload } from '../pg-pubsub'
import { ListenerDiscovery } from './listener-discovery.service'
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
          users: [] as unknown as PgTableChangeListener<unknown>[],
        },
        tableNames: ['users'],
      })

      // Mock queue service to return messages
      queueService.fetchPendingMessages.mockResolvedValue(mockMessages)

      await messageProcessorService.pullAndProcessMessages('test_channel', mockDiscovery)

      // Verify messages were processed
      expect(queueService.fetchPendingMessages).toHaveBeenCalledWith('test_channel')
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
      queueService.fetchPendingMessages.mockResolvedValue(mockMessages)

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

      const listenersMap = {
        users: [usersListener],
        roles: [rolesListener],
      }

      await messageProcessorService['processChanges'](changes, listenersMap)

      // Verify listeners were called with appropriate changes
      expect(usersListener.process).toHaveBeenCalledWith(
        expect.objectContaining({
          all: expect.arrayContaining([changes[0]]),
          INSERT: expect.arrayContaining([changes[0]]),
        }),
        expect.anything()
      )

      expect(rolesListener.process).toHaveBeenCalledWith(
        expect.objectContaining({
          all: expect.arrayContaining([changes[1]]),
          INSERT: expect.arrayContaining([changes[1]]),
        }),
        expect.anything()
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

      const listenersMap = {
        users: [usersListener],
      }

      // This should not throw
      await messageProcessorService['processChanges'](changes, listenersMap)

      // Verify call didn't crash the service
      expect(usersListener.process).toHaveBeenCalled()
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

      const listenersMap = {
        users: [usersListener],
      }

      await messageProcessorService['processChanges'](changes, listenersMap)

      // Verify listener was called once with both changes
      expect(usersListener.process).toHaveBeenCalledTimes(1)
      expect(usersListener.process).toHaveBeenCalledWith(
        expect.objectContaining({
          all: expect.arrayContaining([changes[0], changes[1]]),
          INSERT: expect.arrayContaining([changes[0], changes[1]]),
        }),
        expect.anything()
      )
    })
  })
})
