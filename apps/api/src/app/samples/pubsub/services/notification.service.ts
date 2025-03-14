import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Notification } from '../entities/notification.entity'

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>
  ) {}

  async findAll(): Promise<Notification[]> {
    return this.notificationRepository.find({ relations: ['user'] })
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    })
  }

  async create(data: Partial<Notification>): Promise<Notification> {
    const notification = this.notificationRepository.create(data)
    return this.notificationRepository.save(notification)
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({ where: { id } })
    if (!notification) {
      throw new Error(`Notification with id ${id} not found`)
    }
    notification.read = true
    return this.notificationRepository.save(notification)
  }

  async delete(id: string): Promise<void> {
    await this.notificationRepository.delete(id)
  }
}
