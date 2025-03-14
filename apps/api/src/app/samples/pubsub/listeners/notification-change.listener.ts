import { Injectable, Logger } from '@nestjs/common'
import { PgTableChangeListener, PgTableChanges, RegisterPgTableChangeListener } from '@cisstech/nestjs-pg-pubsub'
import { Notification } from '../entities/notification.entity'
import { WebsocketGateway } from '../gateways/websocket.gateway'

@Injectable()
@RegisterPgTableChangeListener(Notification, {
  // We're interested in all event types
  events: ['INSERT', 'UPDATE', 'DELETE'],
  // Only include these fields in the payload to reduce data transfer
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
