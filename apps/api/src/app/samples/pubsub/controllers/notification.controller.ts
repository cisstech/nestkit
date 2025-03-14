import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common'
import { Notification } from '../entities/notification.entity'
import { NotificationService } from '../services/notification.service'

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async findAll(): Promise<Notification[]> {
    return this.notificationService.findAll()
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string): Promise<Notification[]> {
    return this.notificationService.findByUser(userId)
  }

  @Post()
  async create(@Body() data: Partial<Notification>): Promise<Notification> {
    return this.notificationService.create(data)
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string): Promise<Notification> {
    return this.notificationService.markAsRead(id)
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.notificationService.delete(id)
  }
}
