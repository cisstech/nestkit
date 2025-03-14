import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { User } from '../entities/user.entity'
import { UserService } from '../services/user.service'

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(): Promise<User[]> {
    return this.userService.findAll()
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User | null> {
    return this.userService.findOne(id)
  }

  @Post()
  async create(@Body() data: Partial<User>): Promise<User> {
    return this.userService.create(data)
  }
}
