# Usage

## Decorate Expandable Endpoints

```typescript
// user.controller.ts
import { Controller, Get, NotFoundException } from '@nestjs/common'
import { Expandable } from '@cisstech/nestjs-expand'
import { UserDTO } from './user.dto'
import { UserService } from './user.service'

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @Expandable(UserDTO)
  async getById(@Param('id') id: string): Promise<UserDTO> {
    const user = await this.userService.getById(id)
    if (!user) {
      throw new NotFoundException(`User not found: ${id}`)
    }
    return new UserDTO(user)
  }
}
```

## Implement Expander Services

```typescript
// user.expander.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { ExpandContext, Expander, Expandable } from '@cisstech/nestjs-expand'
import { UserDTO } from './user.dto'
import { CustomerService } from './user.service'

@Injectable()
@Expander(UserDTO)
export class UserExpander {
  constructor(private readonly customerService: CustomerService) {}

  async customer(context: ExpandContext<Request, UserDTO>): Promise<CustomerDTO> {
    const user = context.parent
    const customer = await this.customerService.getById(user.customerId)
    if (!customer) {
      throw new NotFoundException(`Customer not found: ${user.customerId}`)
    }
    return new CustomerDTO(customer)
  }
}
```

## Register the controllers and expanders

```typescript
// app.module.ts

import { Module } from '@nestjs/common'
import { NestKitExpandModule } from '@cisstech/nestjs-expand'
import { UserExpander } from 'PATH_TO_FILE'
import { UserController } from 'PATH_TO_FILE'

@Module({
  imports: [NestKitExpandModule.forRoot()],
  controllers: [UserController],
  providers: [UserExpander],
})
export class AppModule {}
```
