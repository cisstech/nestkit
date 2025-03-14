import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Notification } from './notification.entity'

@Entity('pgpubsub_users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  name!: string

  @Column({ unique: true })
  email!: string

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications!: Notification[]
}
