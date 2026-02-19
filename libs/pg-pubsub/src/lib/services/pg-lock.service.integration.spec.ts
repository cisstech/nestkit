import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PG_PUBSUB_CONFIG } from '../pg-pubsub'
import { PgConnectionPoolService } from './pg-connection-pool.service'
import { PgLockService } from './pg-lock.service'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createTestDatabase } from '@cisstech/testing'

describe('PgLockService', () => {
  let service: PgLockService
  let moduleRef: TestingModule
  let testDbUrl: string

  beforeAll(async () => {
    testDbUrl = await createTestDatabase()
  }, 30000)

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: testDbUrl,
          synchronize: true,
          logging: false,
        }),
      ],
      providers: [
        PgLockService,
        PgConnectionPoolService,
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: {
            databaseUrl: testDbUrl,
          },
        },
      ],
    }).compile()

    await moduleRef.init()
    service = moduleRef.get<PgLockService>(PgLockService)
  })

  afterEach(async () => {
    await moduleRef.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should acquire a lock and execute onAccept', async () => {
    const onAccept = jest.fn()
    const onReject = jest.fn()

    await service.tryLock({
      key: 'pg-test-key',
      duration: 1000,
      onAccept,
      onReject,
    })

    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onReject).not.toHaveBeenCalled()
  })

  it('should reject concurrent lock attempts for the same key', async () => {
    // Create a second module with its own PgConnectionPoolService
    const secondModuleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: testDbUrl,
          synchronize: true,
          logging: false,
          name: 'secondConnection',
        }),
      ],
      providers: [
        PgConnectionPoolService,
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: {
            databaseUrl: testDbUrl,
          },
        },
        {
          provide: 'SecondLockService',
          useFactory: (pgPool: PgConnectionPoolService) => new PgLockService(pgPool),
          inject: [PgConnectionPoolService],
        },
      ],
    }).compile()

    await secondModuleRef.init()
    const secondService = secondModuleRef.get<PgLockService>('SecondLockService')

    // First lock acquisition
    const onAccept1 = jest.fn()
    const onReject1 = jest.fn()

    await service.tryLock({
      key: 'concurrent-test-key',
      duration: 1000,
      onAccept: onAccept1,
      onReject: onReject1,
    })

    // Second lock attempt should be rejected
    const onAccept2 = jest.fn()
    const onReject2 = jest.fn()

    await secondService.tryLock({
      key: 'concurrent-test-key',
      duration: 1000,
      onAccept: onAccept2,
      onReject: onReject2,
    })

    expect(onAccept1).toHaveBeenCalledTimes(1)
    expect(onReject1).not.toHaveBeenCalled()
    expect(onAccept2).not.toHaveBeenCalled()
    expect(onReject2).toHaveBeenCalledTimes(1)

    await secondModuleRef.close()
  })

  it('should respect the lock duration', async () => {
    // Create a second module with its own PgConnectionPoolService
    const secondModuleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: testDbUrl,
          synchronize: true,
          logging: false,
          name: 'secondConnection',
        }),
      ],
      providers: [
        PgConnectionPoolService,
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: {
            databaseUrl: testDbUrl,
          },
        },
        {
          provide: 'SecondLockService',
          useFactory: (pgPool: PgConnectionPoolService) => new PgLockService(pgPool),
          inject: [PgConnectionPoolService],
        },
      ],
    }).compile()

    await secondModuleRef.init()
    const secondService = secondModuleRef.get<PgLockService>('SecondLockService')
    const lockKey = 'duration-test-key'
    const shortDuration = 300 // ms

    // First lock with short duration
    const onAccept1 = jest.fn()
    await service.tryLock({
      key: lockKey,
      duration: shortDuration,
      onAccept: onAccept1,
    })

    expect(onAccept1).toHaveBeenCalledTimes(1)

    // Immediate second attempt should be rejected
    const immediateOnAccept = jest.fn()
    const immediateOnReject = jest.fn()

    await secondService.tryLock({
      key: lockKey,
      duration: 1000,
      onAccept: immediateOnAccept,
      onReject: immediateOnReject,
    })

    expect(immediateOnAccept).not.toHaveBeenCalled()
    expect(immediateOnReject).toHaveBeenCalledTimes(1)

    // Wait for duration to pass
    await new Promise((resolve) => setTimeout(resolve, shortDuration + 100))

    // After duration, lock should be available again
    const laterOnAccept = jest.fn()
    const laterOnReject = jest.fn()

    await secondService.tryLock({
      key: lockKey,
      duration: 1000,
      onAccept: laterOnAccept,
      onReject: laterOnReject,
    })

    expect(laterOnAccept).toHaveBeenCalledTimes(1)
    expect(laterOnReject).not.toHaveBeenCalled()

    await secondModuleRef.close()
  }, 10000)
})
