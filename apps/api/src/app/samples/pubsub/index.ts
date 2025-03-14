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
import { RedisLockService } from './redis/redis-lock.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Notification]),
    PgPubSubModule.forRoot({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      databaseUrl: process.env['DATABASE_URL']!,
      lockService: new RedisLockService(),
    }),
  ],
  controllers: [UserController, NotificationController],
  providers: [UserService, NotificationService, WebsocketGateway, NotificationChangeListener],
})
export class PubSubSampleModule {}
