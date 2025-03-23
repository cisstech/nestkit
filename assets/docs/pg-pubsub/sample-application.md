# Sample Application

The repository includes a complete sample application demonstrating real-time notification functionality using the PgPubSub library. This sample shows how to build a notification system that automatically pushes updates to connected clients when database changes occur.

## Sample Architecture

The sample application consists of:

- **Entities**: User and Notification models
- **Services**: Business logic for users and notifications
- **Controllers**: REST API endpoints
- **Listeners**: PgPubSub listeners to reacts to database changes and sends notifications
- **Gateway**: WebSocket gateway for real-time communication
- **Module**: Wiring everything together with proper configuration

## Entity Definitions

### User Entity

```typescript
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Notification } from './notification.entity'

@Entity('pgpubsub_users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ unique: true })
  email: string

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[]
}
```

### Notification Entity

```typescript
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './user.entity'

export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

@Entity('pgpubsub_notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  title: string

  @Column({ type: 'text' })
  content: string

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type: NotificationType

  @Column({ default: false })
  read: boolean

  @CreateDateColumn()
  createdAt: Date

  @ManyToOne(() => User, (user) => user.notifications)
  user: User

  @Column()
  userId: string
}
```

## PgPubSub Table Change Listener

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { PgTableChangeListener, PgTableChanges, RegisterPgTableChangeListener } from '@cisstech/nestjs-pg-pubsub'
import { Notification } from '../entities/notification.entity'
import { WebsocketGateway } from '../gateways/websocket.gateway'

@Injectable()
@RegisterPgTableChangeListener(Notification, {
  events: ['INSERT', 'UPDATE', 'DELETE'],
  payloadFields: ['id', 'title', 'type', 'read', 'userId'],
})
export class NotificationChangeListener implements PgTableChangeListener<Notification> {
  private readonly logger = new Logger(NotificationChangeListener.name)

  constructor(private readonly websocketGateway: WebsocketGateway) {}

  async process(changes: PgTableChanges<Notification>): Promise<void> {
    this.logger.log(`Processing ${changes.all.length} notification changes`)

    // Handle new notifications
    for (const insert of changes.INSERT) {
      this.websocketGateway.notifyUser(insert.data.userId, 'new-notification', {
        id: insert.data.id,
        title: insert.data.title,
        type: insert.data.type,
      })
    }

    // Handle status changes (read/unread)
    for (const update of changes.UPDATE) {
      if (update.data.updatedFields.includes('read')) {
        this.websocketGateway.notifyUser(update.data.new.userId, 'notification-status-changed', {
          id: update.data.new.id,
          read: update.data.new.read,
        })
      }
    }

    // Handle deleted notifications
    for (const deletion of changes.DELETE) {
      this.websocketGateway.notifyUser(deletion.data.userId, 'notification-deleted', { id: deletion.data.id })
    }
  }
}
```

## WebSocket Gateway

```typescript
import { Injectable } from '@nestjs/common'
import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@Injectable()
@NestWebSocketGateway({ namespace: 'notifications' })
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server

  private userSockets = new Map<string, string[]>()

  handleConnection(client: Socket): void {
    const userId = client.handshake.query['userId'] as string
    if (!userId) {
      client.disconnect()
      return
    }

    // Store the connection
    const userConnections = this.userSockets.get(userId) || []
    userConnections.push(client.id)
    this.userSockets.set(userId, userConnections)
  }

  handleDisconnect(client: Socket): void {
    // Clean up connection from map
    for (const [userId, sockets] of this.userSockets.entries()) {
      const updatedSockets = sockets.filter((id) => id !== client.id)
      if (updatedSockets.length === 0) {
        this.userSockets.delete(userId)
      } else {
        this.userSockets.set(userId, updatedSockets)
      }
    }
  }

  notifyUser(userId: string, eventName: string, data: unknown): void {
    const userSocketIds = this.userSockets.get(userId)
    if (userSocketIds && userSocketIds.length) {
      for (const socketId of userSocketIds) {
        this.server.to(socketId).emit(eventName, data)
      }
    }
  }
}
```

## Module Configuration

```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PgPubSubModule } from '@cisstech/nestjs-pg-pubsub'
import { User } from './entities/user.entity'
import { Notification } from './entities/notification.entity'
import { UserService } from './services/user.service'
import { NotificationService } from './services/notification.service'
import { UserController } from './controllers/user.controller'
import { NotificationController } from './controllers/notification.controller'
import { NotificationChangeListener } from './listeners/notification-change.listener'
import { WebsocketGateway } from './gateways/websocket.gateway'

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Notification]),
    PgPubSubModule.forRoot({
      databaseUrl: process.env['DATABASE_URL']!,
    }),
  ],
  controllers: [UserController, NotificationController],
  providers: [UserService, NotificationService, WebsocketGateway, NotificationChangeListener],
})
export class PubSubSampleModule {}
```

## Running the Sample

The sample application can be run using Docker Compose:

1. Make sure you have Docker and Docker Compose installed
2. Create a `.env` file in the root of the project:

```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=your_database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/your_database

# Redis (for distributed lock service)
REDIS_HOST=localhost
REDIS_PORT=6379
```

3. Start the containers:

```bash
docker-compose up -d
```

4. Run the application:

   ```bash
   yarn nx run api:serve
   ```

5. The API will be available at <http://localhost:3000/api/v1>

## Testing with HTTP Requests

The repository includes a `.http` (at samples/demo/requests.http) file for testing the API with the REST Client extension for VS Code:

```http
@baseUrl = http://localhost:3000/api/v1
@userIdOne = {{createUser.response.body.id}}
@userIdTwo = {{createSecondUser.response.body.id}}
@notificationIdOne = {{createNotification.response.body.id}}

### Create first user
# @name createUser
POST {{baseUrl}}/users HTTP/1.1
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john.doe@example.com"
}

### Create notification for first user
# @name createNotification
POST {{baseUrl}}/notifications HTTP/1.1
Content-Type: application/json

{
  "title": "Welcome!",
  "content": "Welcome to our platform, John!",
  "userId": "{{userIdOne}}",
  "type": "info"
}

### Mark notification as read
# This will trigger an UPDATE event
PUT {{baseUrl}}/notifications/{{notificationIdOne}}/read HTTP/1.1
```

## Client-Side WebSocket Integration

To integrate with the notification system from a client application:

```javascript
import { io } from 'socket.io-client'

// Connect to WebSocket server
const socket = io('http://localhost:3000/notifications', {
  query: { userId: 'USER_ID_HERE' },
})

// Listen for notification events
socket.on('new-notification', (notification) => {
  console.log('New notification received:', notification)
  // Update your UI here
})

socket.on('notification-status-changed', (data) => {
  console.log('Notification status changed:', data)
  // Update the read status in your UI
})

socket.on('notification-deleted', (data) => {
  console.log('Notification was deleted:', data)
  // Remove the notification from your UI
})
```

Run the socket client with `node apps/api/src/app/samples/pubsub/demo/client-demo.js`

This sample demonstrates how to build a complete real-time notification system using PgPubSub, WebSockets, and PostgreSQL.
