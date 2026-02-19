import { Test } from '@nestjs/testing'
import { PgConnectionPoolService } from './pg-connection-pool.service'
import { PgLockService } from './pg-lock.service'

jest.mock('../pg-pubsub.utils', () => ({
  hashStringToInt: jest.fn().mockReturnValue(12345),
}))

describe('PgLockService', () => {
  let pgLockService: PgLockService
  let pgPool: {
    acquireClient: jest.Mock
  }
  let mockClient: {
    query: jest.Mock
    release: jest.Mock
  }

  beforeEach(async () => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    }

    pgPool = {
      acquireClient: jest.fn().mockResolvedValue(mockClient),
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        PgLockService,
        {
          provide: PgConnectionPoolService,
          useValue: pgPool,
        },
      ],
    }).compile()

    pgLockService = moduleRef.get<PgLockService>(PgLockService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  describe('tryLock', () => {
    it('should execute callback when lock is acquired', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ acquired: true }] })

      const onAccept = jest.fn()
      const onReject = jest.fn()

      await pgLockService.tryLock({
        key: 'test-lock',
        duration: 1000,
        onAccept,
        onReject,
      })

      expect(pgPool.acquireClient).toHaveBeenCalled()
      expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1) as acquired', [12345])
      expect(onAccept).toHaveBeenCalled()
      expect(onReject).not.toHaveBeenCalled()
    })

    it('should release lock after duration', async () => {
      jest.useFakeTimers()
      mockClient.query.mockResolvedValueOnce({ rows: [{ acquired: true }] })

      const onAccept = jest.fn()

      await pgLockService.tryLock({
        key: 'test-lock',
        duration: 1000,
        onAccept,
      })

      // Verify lock is acquired
      expect(onAccept).toHaveBeenCalled()

      // Fast-forward time
      jest.advanceTimersByTime(1100)

      // Allow async timeout callback to complete
      await Promise.resolve()

      // Verify lock is released on the same client
      expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [12345])
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('should call onReject when lock cannot be acquired', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ acquired: false }] })

      const onAccept = jest.fn()
      const onReject = jest.fn()

      await pgLockService.tryLock({
        key: 'test-lock',
        duration: 1000,
        onAccept,
        onReject,
      })

      expect(onAccept).not.toHaveBeenCalled()
      expect(onReject).toHaveBeenCalled()
      // Client should be released immediately when lock is not acquired
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('should call onReject when an error occurs', async () => {
      const error = new Error('Database error')
      pgPool.acquireClient.mockRejectedValueOnce(error)

      const onAccept = jest.fn()
      const onReject = jest.fn()

      await pgLockService.tryLock({
        key: 'test-lock',
        duration: 1000,
        onAccept,
        onReject,
      })

      expect(onAccept).not.toHaveBeenCalled()
      expect(onReject).toHaveBeenCalledWith(error)
    })

    it('should use default duration if not provided', async () => {
      jest.useFakeTimers()
      mockClient.query.mockResolvedValueOnce({ rows: [{ acquired: true }] })

      const onAccept = jest.fn()

      await pgLockService.tryLock({
        key: 'test-lock',
        duration: 0, // Invalid duration
        onAccept,
      })

      // Verify default timeout is used (10 seconds)
      jest.advanceTimersByTime(10100)

      // Allow async timeout callback to complete
      await Promise.resolve()

      // Verify lock is released after default duration
      expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [12345])
    })
  })
})
