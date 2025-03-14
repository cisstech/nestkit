import { PgPubSubModule } from '@cisstech/nestjs-pg-pubsub'
import { createTestDatabase } from '@cisstech/testing'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Notification, NotificationType } from '../entities/notification.entity'
import { User } from '../entities/user.entity'
import { WebsocketGateway } from '../gateways/websocket.gateway'
import { NotificationChangeListener } from '../listeners/notification-change.listener'
import { NotificationService } from '../services/notification.service'
import { UserService } from '../services/user.service'

describe('PgPubSub Integration Tests', () => {
  let app: INestApplication
  let userService: UserService
  let notificationService: NotificationService

  // Mock implementation of WebsocketGateway to verify it receives notifications
  const mockWebsocketGateway = {
    notifyUser: jest.fn(),
  }

  beforeAll(async () => {
    // Create a test database
    const testDbUrl = await createTestDatabase()

    // Now create the actual test module
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: testDbUrl,
          entities: [User, Notification],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, Notification]),
        PgPubSubModule.forRoot({
          databaseUrl: testDbUrl,
        }),
      ],
      providers: [
        UserService,
        NotificationService,
        {
          provide: WebsocketGateway,
          useValue: mockWebsocketGateway,
        },
        NotificationChangeListener,
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()

    userService = moduleRef.get<UserService>(UserService)
    notificationService = moduleRef.get<NotificationService>(NotificationService)
  }, 30000)

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('User management', () => {
    it('should create a user', async () => {
      const user = await userService.create({
        name: 'Test User',
        email: 'test@example.com',
      })

      expect(user).toBeDefined()
      expect(user.id).toBeDefined()
      expect(user.name).toBe('Test User')
      expect(user.email).toBe('test@example.com')
    })

    it('should find users', async () => {
      await userService.create({
        name: 'Another User',
        email: 'another@example.com',
      })

      const users = await userService.findAll()
      expect(users.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Notification management', () => {
    let testUser: User

    beforeEach(async () => {
      testUser = await userService.create({
        name: 'Notification Test User',
        email: `notification-test-${Date.now()}@example.com`,
      })
    })

    it('should create a notification and trigger WebSocket notification', async () => {
      // Create a notification
      const notification = await notificationService.create({
        title: 'Test Notification',
        content: 'This is a test notification',
        type: NotificationType.INFO,
        userId: testUser.id,
      })

      expect(notification).toBeDefined()
      expect(notification.id).toBeDefined()

      // Wait a bit for the PgPubSub to process the change
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check if the websocket notification was triggered
      expect(mockWebsocketGateway.notifyUser).toHaveBeenCalledWith(
        testUser.id,
        'new-notification',
        expect.objectContaining({
          id: notification.id,
          title: 'Test Notification',
          type: NotificationType.INFO,
        })
      )
    })

    it('should mark a notification as read and trigger WebSocket notification', async () => {
      // Create a notification
      const notification = await notificationService.create({
        title: 'Read Test',
        content: 'This notification will be marked as read',
        userId: testUser.id,
      })

      // Clear previous mock calls
      mockWebsocketGateway.notifyUser.mockClear()

      // Mark as read
      const updatedNotification = await notificationService.markAsRead(notification.id)
      expect(updatedNotification.read).toBe(true)

      // Wait a bit for the PgPubSub to process the change
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check if the websocket notification was triggered
      expect(mockWebsocketGateway.notifyUser).toHaveBeenCalledWith(
        testUser.id,
        'notification-status-changed',
        expect.objectContaining({
          id: notification.id,
          read: true,
        })
      )
    })

    it('should delete a notification and trigger WebSocket notification', async () => {
      // Create a notification
      const notification = await notificationService.create({
        title: 'Delete Test',
        content: 'This notification will be deleted',
        userId: testUser.id,
      })

      // Clear previous mock calls
      mockWebsocketGateway.notifyUser.mockClear()

      // Delete the notification
      await notificationService.delete(notification.id)

      // Wait a bit for the PgPubSub to process the change
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check if the websocket notification was triggered
      expect(mockWebsocketGateway.notifyUser).toHaveBeenCalledWith(
        testUser.id,
        'notification-deleted',
        expect.objectContaining({
          id: notification.id,
        })
      )

      // Verify it's really deleted
      const userNotifications = await notificationService.findByUser(testUser.id)
      expect(userNotifications.find((n) => n.id === notification.id)).toBeUndefined()
    })
  })
})
