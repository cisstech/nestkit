/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { PG_PUBSUB_CONFIG } from '../pg-pubsub'
import { QueueService } from './queue.service'

describe('QueueService', () => {
  let queueService: QueueService
  let dataSource: {
    query: jest.Mock
    createQueryRunner: jest.Mock
  }
  const config = {
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    triggerPrefix: 'test_prefix',
    queue: {
      schema: 'test_schema',
      table: 'test_queue',
      maxRetries: 3,
      messageTTL: 3600000,
      cleanupInterval: 60000,
    },
  }

  beforeEach(async () => {
    // Mock QueryRunner
    const queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    }

    // Mock DataSource
    dataSource = {
      query: jest.fn(),
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: config,
        },
      ],
    }).compile()

    queueService = moduleRef.get<QueueService>(QueueService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('setup', () => {
    it('should create queue table and start cleanup', async () => {
      const startCleanupSpy = jest.spyOn(queueService as any, 'startCleanup')

      await queueService.setup()

      expect(dataSource.query).toHaveBeenCalled()
      expect(startCleanupSpy).toHaveBeenCalled()
    })
  })

  describe('fetchPendingMessages', () => {
    it('should fetch pending messages for a channel', async () => {
      const mockMessages = [{ id: 1, channel: 'test_channel', payload: {} }]
      const queryRunner = dataSource.createQueryRunner()

      queryRunner.query = jest.fn().mockResolvedValue([mockMessages])

      const result = await queueService.fetchPendingMessages('test_channel')

      expect(queryRunner.startTransaction).toHaveBeenCalled()
      expect(queryRunner.query).toHaveBeenCalled()
      expect(queryRunner.commitTransaction).toHaveBeenCalled()
      expect(result).toEqual(mockMessages)
    })

    it('should rollback transaction on error', async () => {
      const queryRunner = dataSource.createQueryRunner()
      const error = new Error('Database error')
      queryRunner.query = jest.fn().mockRejectedValue(error)

      await expect(queueService.fetchPendingMessages('test_channel')).rejects.toThrow(error)

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled()
      expect(queryRunner.release).toHaveBeenCalled()
    })
  })

  describe('markAsProcessed', () => {
    it('should mark a message as processed', async () => {
      await queueService.markAsProcessed([1])

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining(`UPDATE "${config.queue.schema}"."${config.queue.table}"`),
        [[1]]
      )
    })
  })

  describe('markAsFailed', () => {
    it('should mark a message as failed and update retry count', async () => {
      await queueService.markAsFailed([1])

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining(`UPDATE "${config.queue.schema}"."${config.queue.table}"`),
        [config.queue.maxRetries, [1]]
      )
    })
  })

  describe('cleanupOldMessages', () => {
    it('should delete processed messages older than TTL', async () => {
      dataSource.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])

      await (queueService as any).cleanupOldMessages()

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining(`DELETE FROM "${config.queue.schema}"."${config.queue.table}"`),
        expect.any(Array)
      )
    })
  })
})
