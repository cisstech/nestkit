# Sample Application

The repository includes a working sample at `apps/app/src/app/samples/pubsub/` that wires together:

- Two TypeORM entities (`User`, `Notification`)
- A `PgTableChangeListener` that reacts to notification inserts/updates/deletes
- A Socket.IO WebSocket gateway that pushes changes to connected clients in real-time
- REST controllers for CRUD operations

## Running It

1. Start PostgreSQL and Redis:

```bash
docker-compose up -d
```

2. Create a `.env` file:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/your_database
REDIS_HOST=localhost
REDIS_PORT=6379
```

3. Start the API:

```bash
yarn nx run api:serve
```

4. The API is available at `http://localhost:3000/api/v1`

## Testing

Use the REST Client file at `samples/demo/requests.http` to create users and notifications via the API. Changes are automatically pushed to connected WebSocket clients.

Connect a WebSocket client:

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000/notifications', {
  query: { userId: 'USER_ID' },
})

socket.on('new-notification', (data) => console.log('new:', data))
socket.on('notification-status-changed', (data) => console.log('updated:', data))
socket.on('notification-deleted', (data) => console.log('deleted:', data))
```

Or run the included client: `node apps/api/src/app/samples/pubsub/demo/client-demo.js`

## How the Listener Works

The key piece is `NotificationChangeListener`:

```typescript
@Injectable()
@RegisterPgTableChangeListener(Notification, {
  events: ['INSERT', 'UPDATE', 'DELETE'],
  payloadFields: ['id', 'title', 'type', 'read', 'userId'],
})
export class NotificationChangeListener implements PgTableChangeListener<Notification> {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  async process(changes: PgTableChanges<Notification>, ctx: PgTableChangeContext): Promise<void> {
    for (const insert of changes.INSERT) {
      this.websocketGateway.notifyUser(insert.data.userId, 'new-notification', {
        id: insert.data.id,
        title: insert.data.title,
        type: insert.data.type,
      })
    }

    for (const update of changes.UPDATE) {
      if (update.data.updatedFields.includes('read')) {
        this.websocketGateway.notifyUser(update.data.new.userId, 'notification-status-changed', {
          id: update.data.new.id,
          read: update.data.new.read,
        })
      }
    }

    for (const deletion of changes.DELETE) {
      this.websocketGateway.notifyUser(deletion.data.userId, 'notification-deleted', { id: deletion.data.id })
    }
  }
}
```

Note how the listener stays fast: it just dispatches to the WebSocket gateway without any DB writes or transactions. See [Usage > Important Constraints](./getting-started#important-constraints) for why this matters.
