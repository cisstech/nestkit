import { createTestDatabase } from '@cisstech/testing'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { NotificationController } from '../controllers/notification.controller'
import { UserController } from '../controllers/user.controller'
import { Notification, NotificationType } from '../entities/notification.entity'
import { User } from '../entities/user.entity'
import { NotificationService } from '../services/notification.service'
import { UserService } from '../services/user.service'

describe('Controller Integration Tests', () => {
  let app: INestApplication
  let userId: string

  beforeAll(async () => {
    // Create a test database
    const testDbUrl = await createTestDatabase()

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
      ],
      controllers: [UserController, NotificationController],
      providers: [UserService, NotificationService],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  }, 30000)

  afterAll(async () => {
    await app.close()
  })

  describe('User Controller', () => {
    it('POST /users - should create a user', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Test User',
          email: 'test-controller@example.com',
        })
        .expect(201)

      expect(response.body).toBeDefined()
      expect(response.body.id).toBeDefined()
      expect(response.body.name).toBe('Test User')

      userId = response.body.id
    })

    it('GET /users - should return all users', async () => {
      const response = await request(app.getHttpServer()).get('/users').expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThanOrEqual(1)
    })

    it('GET /users/:id - should return a specific user', async () => {
      const response = await request(app.getHttpServer()).get(`/users/${userId}`).expect(200)

      expect(response.body.id).toBe(userId)
      expect(response.body.name).toBe('Test User')
    })
  })

  describe('Notification Controller', () => {
    let notificationId: string

    it('POST /notifications - should create a notification', async () => {
      const response = await request(app.getHttpServer())
        .post('/notifications')
        .send({
          title: 'Test Notification',
          content: 'This is a test notification from controller tests',
          userId,
          type: NotificationType.INFO,
        })
        .expect(201)

      expect(response.body).toBeDefined()
      expect(response.body.id).toBeDefined()
      expect(response.body.title).toBe('Test Notification')
      expect(response.body.userId).toBe(userId)

      notificationId = response.body.id
    })

    it('GET /notifications - should return all notifications', async () => {
      const response = await request(app.getHttpServer()).get('/notifications').expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThanOrEqual(1)
      expect(response.body.some((n: { id: string }) => n.id === notificationId)).toBe(true)
    })

    it('GET /notifications/user/:userId - should return notifications for user', async () => {
      const response = await request(app.getHttpServer()).get(`/notifications/user/${userId}`).expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThanOrEqual(1)
      expect(response.body.some((n: { id: string }) => n.id === notificationId)).toBe(true)
    })

    it('PUT /notifications/:id/read - should mark notification as read', async () => {
      const response = await request(app.getHttpServer()).put(`/notifications/${notificationId}/read`).expect(200)

      expect(response.body.id).toBe(notificationId)
      expect(response.body.read).toBe(true)
    })

    it('DELETE /notifications/:id - should delete a notification', async () => {
      await request(app.getHttpServer()).delete(`/notifications/${notificationId}`).expect(200)

      // Verify it's deleted by trying to fetch it
      const userNotifications = await request(app.getHttpServer()).get(`/notifications/user/${userId}`).expect(200)

      expect(userNotifications.body.some((n: { id: string }) => n.id === notificationId)).toBe(false)
    })
  })
})
