import { Test } from '@nestjs/testing'
import { InMemoryLockService } from './in-memory-lock.service'

describe('InMemoryLockService', () => {
  let service: InMemoryLockService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [InMemoryLockService],
    }).compile()

    service = module.get<InMemoryLockService>(InMemoryLockService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should acquire a lock and execute onAccept callback', async () => {
    const onAccept = jest.fn()
    await service.tryLock({
      key: 'test-lock-1',
      duration: 100,
      onAccept,
    })

    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('should reject lock acquisition if the key is already locked', async () => {
    const onAccept = jest.fn()
    const onReject = jest.fn()

    // Acquire the first lock
    await service.tryLock({
      key: 'test-lock-2',
      duration: 500,
      onAccept: jest.fn(),
    })

    // Try to acquire it again before expiration
    await service.tryLock({
      key: 'test-lock-2',
      duration: 100,
      onAccept,
      onReject,
    })

    expect(onAccept).not.toHaveBeenCalled()
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('should allow lock acquisition after the previous lock expires', async () => {
    const onAccept = jest.fn()

    // Acquire the first lock with a short duration
    await service.tryLock({
      key: 'test-lock-3',
      duration: 100,
      onAccept: jest.fn(),
    })

    // Wait for the lock to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Try to acquire it again after expiration
    await service.tryLock({
      key: 'test-lock-3',
      duration: 100,
      onAccept,
    })

    expect(onAccept).toHaveBeenCalledTimes(1)
  })
})
