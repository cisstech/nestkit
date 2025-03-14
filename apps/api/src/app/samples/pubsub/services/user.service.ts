import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find()
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } })
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data)
    return this.userRepository.save(user)
  }
}
