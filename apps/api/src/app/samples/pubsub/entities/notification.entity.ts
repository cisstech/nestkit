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
  id!: string

  @Column()
  title!: string

  @Column({ type: 'text' })
  content!: string

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type!: NotificationType

  @Column({ default: false })
  read!: boolean

  @CreateDateColumn()
  createdAt!: Date

  @ManyToOne(() => User, (user) => user.notifications)
  user!: User

  @Column()
  userId!: string
}
