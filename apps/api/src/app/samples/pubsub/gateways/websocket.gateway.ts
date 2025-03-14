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
  private server!: Server

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
