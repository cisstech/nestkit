import { INestApplication, Injectable } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm'
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Repository } from 'typeorm'
import { PgPubSubModule, PgTableChangeListener, PgTableChanges, RegisterPgTableChangeListener } from '..'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createTestDatabase } from '@cisstech/testing'

/**
 * Test entity for integration testing
 */
@Entity('pg_pubsub_test_entity')
class TestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  name!: string

  @Column({ default: false })
  active!: boolean

  @CreateDateColumn()
  createdAt!: Date
}

/**
 * Mock listener for testing purposes
 */
@Injectable()
@RegisterPgTableChangeListener(TestEntity, {
  events: ['INSERT', 'UPDATE', 'DELETE'],
  payloadFields: ['id', 'name', 'active'],
})
class TestEntityListener implements PgTableChangeListener<TestEntity> {
  public insertEvents: TestEntity[] = []
  public updateEvents: Array<{
    old: TestEntity
    new: TestEntity
    updatedFields: string[]
  }> = []
  public deleteEvents: TestEntity[] = []
  public processCallCount = 0

  async process(changes: PgTableChanges<TestEntity>): Promise<void> {
    this.processCallCount++

    // Store received events
    changes.INSERT.forEach((insert) => this.insertEvents.push(insert.data))
    changes.UPDATE.forEach((update) => this.updateEvents.push(update.data))
    changes.DELETE.forEach((deletion) => this.deleteEvents.push(deletion.data))
  }
}

describe('PgPubSub Integration Test', () => {
  let app: INestApplication
  let moduleRef: TestingModule
  let repository: Repository<TestEntity>
  let listener: TestEntityListener

  beforeAll(async () => {
    const testDbUrl = await createTestDatabase()

    // Now create the actual test module
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: testDbUrl,
          entities: [TestEntity],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([TestEntity]),
        PgPubSubModule.forRoot({
          databaseUrl: testDbUrl,
        }),
      ],
      providers: [TestEntityListener],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()

    repository = moduleRef.get<Repository<TestEntity>>(getRepositoryToken(TestEntity))
    listener = moduleRef.get<TestEntityListener>(TestEntityListener)

    // Wait for PgPubSub to initialize triggers
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }, 30000) // Increase timeout for database initialization

  afterAll(async () => {
    await app?.close()
  }, 10000)

  it('should detect an INSERT event', async () => {
    // Create a test entity
    const entity = await repository.save({
      name: 'Test INSERT',
      active: true,
    })

    // Wait for event processing
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check if the listener received the event
    expect(listener.insertEvents.length).toBeGreaterThanOrEqual(1)
    expect(listener.insertEvents.some((e) => e.id === entity.id)).toBe(true)
    expect(listener.insertEvents.some((e) => e.name === 'Test INSERT')).toBe(true)
  })

  it('should detect an UPDATE event', async () => {
    // Create a test entity
    const entity = await repository.save({
      name: 'Test UPDATE',
      active: false,
    })

    // Clear previous events
    listener.updateEvents = []

    // Update the entity
    await repository.update(entity.id, { active: true, name: 'Test UPDATE - Modified' })

    // Wait for event processing
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check if the listener received the event
    expect(listener.updateEvents.length).toBeGreaterThanOrEqual(1)

    const updateEvent = listener.updateEvents.find((e) => e.new.id === entity.id)
    expect(updateEvent).toBeDefined()
    if (updateEvent) {
      expect(updateEvent.old.active).toBe(false)
      expect(updateEvent.new.active).toBe(true)
      expect(updateEvent.old.name).toBe('Test UPDATE')
      expect(updateEvent.new.name).toBe('Test UPDATE - Modified')
      expect(updateEvent.updatedFields).toContain('active')
      expect(updateEvent.updatedFields).toContain('name')
    }
  })

  it('should detect a DELETE event', async () => {
    // Create a test entity
    const entity = await repository.save({
      name: 'Test DELETE',
      active: true,
    })

    // Clear previous events
    listener.deleteEvents = []

    // Delete the entity
    await repository.delete(entity.id)

    // Wait for event processing
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check if the listener received the event
    expect(listener.deleteEvents.length).toBeGreaterThanOrEqual(1)
    expect(listener.deleteEvents.some((e) => e.id === entity.id)).toBe(true)
    expect(listener.deleteEvents.some((e) => e.name === 'Test DELETE')).toBe(true)
  })
})
