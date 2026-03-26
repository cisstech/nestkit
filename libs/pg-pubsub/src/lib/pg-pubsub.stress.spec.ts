/* eslint-disable @typescript-eslint/no-explicit-any */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm'
import { Column, DataSource, Entity, PrimaryGeneratedColumn, Repository } from 'typeorm'
import {
  PgPubSubModule,
  PgPubSubService,
  PgTableChangeListener,
  PgTableChanges,
  RegisterPgTableChangeListener,
} from '..'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createTestDatabase } from '@cisstech/testing'

const MESSAGE_COUNT = parseInt(process.env['STRESS_MESSAGE_COUNT'] || '1000', 10)
const BATCH_SIZE = parseInt(process.env['STRESS_BATCH_SIZE'] || '50', 10)
const TIMEOUT_MS = parseInt(process.env['STRESS_TIMEOUT_MS'] || '60000', 10)

const QUEUE_TABLE = 'stress_pg_pubsub_queue'

@Entity('stress_users')
class StressUser {
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  name!: string

  @Column()
  email!: string
}

@Entity('stress_orders')
class StressOrder {
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  product!: string

  @Column({ type: 'int' })
  quantity!: number
}

@RegisterPgTableChangeListener(StressUser)
class StressUserListener implements PgTableChangeListener<StressUser> {
  receivedIds: number[] = []
  processingDelay = 0

  async process(changes: PgTableChanges<StressUser>): Promise<void> {
    for (const change of changes.all) {
      this.receivedIds.push(change.id)
    }
    if (this.processingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.processingDelay))
    }
  }
}

@RegisterPgTableChangeListener(StressOrder)
class StressOrderListener implements PgTableChangeListener<StressOrder> {
  receivedIds: number[] = []
  processingDelay = 0

  async process(changes: PgTableChanges<StressOrder>): Promise<void> {
    for (const change of changes.all) {
      this.receivedIds.push(change.id)
    }
    if (this.processingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.processingDelay))
    }
  }
}

async function insertUsers(repo: Repository<StressUser>, total: number, batchSize: number, offset = 0): Promise<void> {
  for (let i = 0; i < total; i += batchSize) {
    const size = Math.min(batchSize, total - i)
    await Promise.all(
      Array.from({ length: size }, (_, j) =>
        repo.save({ name: `User ${offset + i + j}`, email: `user${offset + i + j}@stress.test` })
      )
    )
  }
}

async function insertOrders(repo: Repository<StressOrder>, total: number, batchSize: number): Promise<void> {
  for (let i = 0; i < total; i += batchSize) {
    const size = Math.min(batchSize, total - i)
    await Promise.all(
      Array.from({ length: size }, (_, j) => repo.save({ product: `Product ${i + j}`, quantity: i + j + 1 }))
    )
  }
}

async function waitFor(check: () => boolean, timeoutMs: number, intervalMs = 200): Promise<void> {
  const start = Date.now()
  while (!check() && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

interface QueueStats {
  pending: number
  processing: number
  processed: number
  failed: number
}

async function getQueueStats(dataSource: DataSource): Promise<QueueStats> {
  const rows = await dataSource.query(`SELECT status, count(*)::int as cnt FROM "${QUEUE_TABLE}" GROUP BY status`)
  const stats: QueueStats = { pending: 0, processing: 0, processed: 0, failed: 0 }
  for (const row of rows) {
    stats[row.status as keyof QueueStats] = row.cnt
  }
  return stats
}

describe('PgPubSub Stress Tests', () => {
  let app: INestApplication
  let dataSource: DataSource
  let userRepo: Repository<StressUser>
  let orderRepo: Repository<StressOrder>
  let userListener: StressUserListener
  let orderListener: StressOrderListener
  let pgPubSub: PgPubSubService

  beforeAll(async () => {
    const testDbUrl = await createTestDatabase()

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: testDbUrl,
          entities: [StressUser, StressOrder],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([StressUser, StressOrder]),
        PgPubSubModule.forRoot({
          databaseUrl: testDbUrl,
          triggerPrefix: 'stress_pubsub',
          queue: {
            table: QUEUE_TABLE,
            maxRetries: 3,
            batchSize: 20,
            drainInterval: 10,
            processingTimeout: 2000,
          },
        }),
      ],
      providers: [StressUserListener, StressOrderListener],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()

    dataSource = app.get(DataSource)
    userRepo = app.get(getRepositoryToken(StressUser))
    orderRepo = app.get(getRepositoryToken(StressOrder))
    userListener = app.get(StressUserListener)
    orderListener = app.get(StressOrderListener)
    pgPubSub = app.get(PgPubSubService)

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }, 30000)

  afterAll(async () => {
    await app?.close()
  }, 15000)

  beforeEach(async () => {
    userListener.receivedIds = []
    userListener.processingDelay = 0
    orderListener.receivedIds = []
    orderListener.processingDelay = 0

    await pgPubSub.withTriggersDisabled(async (em) => {
      await em.query('DELETE FROM stress_users')
      await em.query('DELETE FROM stress_orders')
    })
    await dataSource.query(`DELETE FROM "${QUEUE_TABLE}"`)
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  it(
    'zero message loss under slow consumer backpressure',
    async () => {
      userListener.processingDelay = 50

      await insertUsers(userRepo, MESSAGE_COUNT, BATCH_SIZE)

      await waitFor(() => userListener.receivedIds.length >= MESSAGE_COUNT, TIMEOUT_MS)

      const stats = await getQueueStats(dataSource)

      console.log(`  [backpressure] ${userListener.receivedIds.length}/${MESSAGE_COUNT} received`)
      console.log(
        `  [backpressure] queue: processed=${stats.processed} pending=${stats.pending} processing=${stats.processing} failed=${stats.failed}`
      )

      expect(userListener.receivedIds.length).toBe(MESSAGE_COUNT)
      expect(stats.pending).toBe(0)
      expect(stats.processing).toBe(0)
      expect(stats.failed).toBe(0)
    },
    TIMEOUT_MS + 30000
  )

  it(
    'pause/resume preserves all in-flight and queued messages',
    async () => {
      const half = Math.floor(MESSAGE_COUNT / 2)

      await insertUsers(userRepo, half, BATCH_SIZE)

      await waitFor(() => userListener.receivedIds.length > 0, 5000, 50)
      const beforePause = userListener.receivedIds.length

      await pgPubSub.pause()

      await insertUsers(userRepo, half, BATCH_SIZE, half)

      await new Promise((resolve) => setTimeout(resolve, 500))
      const duringPause = userListener.receivedIds.length

      await pgPubSub.resume()

      await waitFor(() => userListener.receivedIds.length >= MESSAGE_COUNT, TIMEOUT_MS)

      const stats = await getQueueStats(dataSource)

      console.log(
        `  [pause/resume] before=${beforePause} during=${duringPause} final=${userListener.receivedIds.length}/${MESSAGE_COUNT}`
      )
      console.log(
        `  [pause/resume] queue: processed=${stats.processed} pending=${stats.pending} failed=${stats.failed}`
      )

      expect(userListener.receivedIds.length).toBe(MESSAGE_COUNT)
      expect(stats.pending).toBe(0)
      expect(stats.failed).toBe(0)
    },
    TIMEOUT_MS + 30000
  )

  it(
    'concurrent writers produce no duplicates and no loss',
    async () => {
      const writers = 5
      const perWriter = Math.ceil(MESSAGE_COUNT / writers)

      await Promise.all(
        Array.from({ length: writers }, (_, w) => insertUsers(userRepo, perWriter, BATCH_SIZE, w * perWriter))
      )

      const totalExpected = perWriter * writers

      await waitFor(() => userListener.receivedIds.length >= totalExpected, TIMEOUT_MS)

      const stats = await getQueueStats(dataSource)
      const uniqueIds = new Set(userListener.receivedIds)

      console.log(
        `  [concurrent] ${userListener.receivedIds.length}/${totalExpected} received, ${uniqueIds.size} unique`
      )
      console.log(
        `  [concurrent] queue: processed=${stats.processed} pending=${stats.pending} processing=${stats.processing} failed=${stats.failed}`
      )

      expect(uniqueIds.size).toBe(userListener.receivedIds.length)
      expect(userListener.receivedIds.length).toBe(totalExpected)
      expect(stats.pending).toBe(0)
      expect(stats.processing).toBe(0)
      expect(stats.failed).toBe(0)
    },
    TIMEOUT_MS + 30000
  )

  it(
    'concurrent multi-table processing with no cross-contamination',
    async () => {
      userListener.processingDelay = 100
      orderListener.processingDelay = 0

      const half = Math.floor(MESSAGE_COUNT / 2)

      await Promise.all([insertUsers(userRepo, half, BATCH_SIZE), insertOrders(orderRepo, half, BATCH_SIZE)])

      await waitFor(
        () => userListener.receivedIds.length >= half && orderListener.receivedIds.length >= half,
        TIMEOUT_MS
      )

      const stats = await getQueueStats(dataSource)
      const userIdSet = new Set(userListener.receivedIds)
      const orderIdSet = new Set(orderListener.receivedIds)
      const overlap = [...userIdSet].filter((id) => orderIdSet.has(id))

      console.log(
        `  [multi-table] users=${userListener.receivedIds.length}/${half} orders=${orderListener.receivedIds.length}/${half}`
      )
      console.log(`  [multi-table] queue: processed=${stats.processed} pending=${stats.pending} failed=${stats.failed}`)
      console.log(`  [multi-table] cross-contamination: ${overlap.length} overlapping IDs`)

      expect(userListener.receivedIds.length).toBe(half)
      expect(orderListener.receivedIds.length).toBe(half)
      expect(overlap).toHaveLength(0)
      expect(stats.pending).toBe(0)
      expect(stats.failed).toBe(0)
    },
    TIMEOUT_MS + 30000
  )
})
