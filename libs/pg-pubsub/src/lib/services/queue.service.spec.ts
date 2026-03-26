/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test } from '@nestjs/testing'
import { PG_PUBSUB_CONFIG } from '../pg-pubsub'
import { PgConnectionPoolService } from './pg-connection-pool.service'
import { QueueService } from './queue.service'

describe('QueueService', () => {
  let queueService: QueueService
  let pgPool: {
    query: jest.Mock
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
      batchSize: 100,
      processingTimeout: 300000,
    },
  }

  beforeEach(async () => {
    pgPool = {
      query: jest.fn(),
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: PgConnectionPoolService,
          useValue: pgPool,
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

  describe('ensureQueueTable', () => {
    it('should create queue table and indexes', async () => {
      await queueService.ensureQueueTable()

      expect(pgPool.query).toHaveBeenCalledWith(
        expect.stringContaining(`CREATE TABLE IF NOT EXISTS "${config.queue.schema}"."${config.queue.table}"`)
      )
    })
  })

  describe('startWorker', () => {
    it('should recover orphans, run cleanup, and start periodic cleanup', async () => {
      const cleanupSpy = jest.spyOn(queueService as any, 'cleanupOldMessages').mockResolvedValue(undefined)
      const recoverSpy = jest.spyOn(queueService as any, 'recoverOrphanedMessages').mockResolvedValue(undefined)
      const startPeriodicCleanupSpy = jest.spyOn(queueService as any, 'startPeriodicCleanup')

      await queueService.startWorker()

      expect(recoverSpy).toHaveBeenCalled()
      expect(cleanupSpy).toHaveBeenCalled()
      expect(startPeriodicCleanupSpy).toHaveBeenCalled()
    })
  })

  describe('fetchPendingMessages', () => {
    it('should fetch pending messages for a channel', async () => {
      const mockMessages = [{ id: 1, channel: 'test_channel', payload: {} }]
      pgPool.query.mockResolvedValue(mockMessages)

      const result = await queueService.fetchPendingMessages('test_channel')

      expect(pgPool.query).toHaveBeenCalledWith(
        expect.stringContaining(`UPDATE "${config.queue.schema}"."${config.queue.table}"`),
        [config.queue.maxRetries, 'test_channel', config.queue.batchSize, 300000]
      )
      expect(result).toEqual(mockMessages)
    })

    it('should return empty array when no messages', async () => {
      pgPool.query.mockResolvedValue(undefined)

      const result = await queueService.fetchPendingMessages('test_channel')

      expect(result).toEqual([])
    })

    it('should throw error on database failure', async () => {
      const error = new Error('Database error')
      pgPool.query.mockRejectedValue(error)

      await expect(queueService.fetchPendingMessages('test_channel')).rejects.toThrow(error)

      expect(pgPool.query).toHaveBeenCalled()
    })
  })

  describe('markAsProcessed', () => {
    it('should mark a message as processed', async () => {
      await queueService.markAsProcessed([1])

      expect(pgPool.query).toHaveBeenCalledWith(
        expect.stringContaining(`UPDATE "${config.queue.schema}"."${config.queue.table}"`),
        [[1]]
      )
    })
  })

  describe('markAsFailed', () => {
    it('should mark a message as failed and update retry count', async () => {
      await queueService.markAsFailed([1])

      expect(pgPool.query).toHaveBeenCalledWith(
        expect.stringContaining(`UPDATE "${config.queue.schema}"."${config.queue.table}"`),
        [config.queue.maxRetries, [1]]
      )
    })
  })

  describe('cleanupOldMessages', () => {
    it('should delete terminal messages older than TTL', async () => {
      pgPool.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])

      await (queueService as any).cleanupOldMessages()

      const query = pgPool.query.mock.calls[0][0]
      expect(query).toContain(`DELETE FROM "${config.queue.schema}"."${config.queue.table}"`)
      expect(query).toContain(`status = 'processed' AND processed_at < $1`)
      expect(query).toContain(`status = 'failed' AND retry_count >= $2 AND created_at < $1`)
      expect(query).toContain(`status = 'processing' AND created_at < $1`)
      expect(pgPool.query).toHaveBeenCalledWith(query, [expect.any(Date), config.queue.maxRetries])
    })
  })

  describe('recoverOrphanedMessages', () => {
    it('should reset recent processing messages back to pending only when next_retry_at has passed', async () => {
      pgPool.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])

      await queueService['recoverOrphanedMessages']()

      const query = pgPool.query.mock.calls[0][0]
      expect(query).toContain(`SET status = 'pending'`)
      expect(query).toContain(`WHERE status = 'processing'`)
      expect(query).toContain(`next_retry_at IS NULL OR next_retry_at <= NOW()`)
      expect(query).toContain(`created_at >= $1`)
      expect(pgPool.query).toHaveBeenCalledWith(query, [expect.any(Date)])
    })

    it('should do nothing when no orphaned messages exist', async () => {
      pgPool.query.mockResolvedValueOnce([])

      await queueService['recoverOrphanedMessages']()

      expect(pgPool.query).toHaveBeenCalledTimes(1)
    })

    it('should throw error on database failure', async () => {
      const error = new Error('Database error')
      pgPool.query.mockRejectedValue(error)

      await expect(queueService['recoverOrphanedMessages']()).rejects.toThrow(error)
    })
  })
})
