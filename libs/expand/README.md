# @cisstech/nest-expand

<div align="center">

A NestJS module to build Dynamic Resource Expansion for APIs

[![CI](https://github.com/cisstech/nestkit/actions/workflows/ci.yml/badge.svg)](https://github.com/cisstech/nestkit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/cisstech/nestkit/branch/main/graph/badge.svg)](https://codecov.io/gh/cisstech/nestkit)
[![codefactor](https://www.codefactor.io/repository/github/cisstech/nestkit/badge/main)](https://www.codefactor.io/repository/github/cisstech/nestkit/overview/main)
[![GitHub Tag](https://img.shields.io/github/tag/cisstech/nestkit.svg)](https://github.com/cisstech/nestkit/tags)
[![npm package](https://img.shields.io/npm/v/@cisstech/nest-expand.svg)](https://www.npmjs.org/package/@cisstech/nestkit)
[![NPM downloads](http://img.shields.io/npm/dm/@cisstech/nest-expand.svg)](https://npmjs.org/package/@cisstech/nest-expand)
[![licence](https://img.shields.io/github/license/cisstech/nestkit)](https://github.com/cisstech/nestkit/blob/main/LICENSE)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

</div>

## Overview

The NestJS Expandable Library is a powerful and flexible extension for NestJS applications, providing a generic pattern for resource expansion in REST APIs. It allows you to dynamically expand and include related resources in API responses, enhancing the flexibility of your API design.

## Features

- Dynamic Resource Expansion: Easily expand related resources in API responses using query parameters.
- Decorator-Based Configuration: Use decorators to mark classes and methods as expanders and expandable, simplifying configuration.
- Enhanced Metadata Handling: Improved handling of metadata allows for multiple decorators of the same type on the same target.
- Configuration and Customization: Configure and customize the library to suit your application's specific needs.
- Error Handling: Graceful handling of errors during expansion with customizable logging options.
- Tested and Reliable: Extensive unit tests ensure the reliability of the library.

## Installation

```bash
npm install nestjs-expandable
```

## Usage

- 1. Decorate Expandable Endpoints

  ```typescript
  // user.controller.ts
  import { Controller, Get, NotFoundException } from '@nestjs/common';
  import { Expandable } from '@cisstech/nest-expand';
  import { UserDTO } from './user.dto';
  import { UserService } from './user.service';

  @Controller('users')
  export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':id')
    @Expandable(UserDTO)
    async getById(@Param('id') id: string): Promise<UserDTO> {
      const user = await this.userService.getById(id);
      if (!user) {
        throw new NotFoundException(`User not found: ${id}`);
      }
      return new UserDTO(user);
    }
  }
  ```

- 2. Implement Expander Services

  ```typescript
  // user.expander.ts
  import { Injectable, NotFoundException } from '@nestjs/common';
  import { ExpandContext, Expander, Expandable } from '@cisstech/nest-expand';
  import { UserDTO } from './user.dto';
  import { CustomerService } from './user.service';

  @Injectable()
  @Expander(UserDTO)
  export class UserExpander {
    constructor(private readonly customerService: CustomerService) {}

    async customer(context: ExpandContext<Request, UserDTO>): Promise<CustomerDTO> {
      const user = context.parent;
      const customer = await this.customerService.getById(user.customerId);
      if (!customer) {
        throw new NotFoundException(`Customer not found: ${user.customerId}`);
      }
      return new CustomerDTO(customer);
    }
  }
  ```

- 3. Register the controllers and expanders

```typescript
// app.module.ts

import { Module } from '@nestjs/common';
import { NestKitExpandModule } from '@cisstech/nest-expand';
import { UserExpander } from 'PATH_TO_FILE';
import { UserController } from 'PATH_TO_FILE';

@Module({
  imports: [NestKitExpandModule.forRoot()],
  controllers: [UserController],
  providers: [UserExpander],
})
export class AppModule {}
```

## Configuration Options

The library provides configuration options to customize its behavior. You can pass an optional configuration object when initializing the ExpandService in your module.

```typescript
// app.module.ts

import { Module } from '@nestjs/common';
import { NestKitExpandModule } from '@cisstech/nest-expand';
import { UserExpander } from 'PATH_TO_FILE';
import { UserController } from 'PATH_TO_FILE';

@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: true,
    }),
  ],
  controllers: [UserController],
  providers: [UserExpander],
})
export class AppModule {}
```

## Documentation

For detailed documentation, examples, and advanced usage, please refer to the official documentation (COMMING SOON)

## License

MIT © [Mamadou Cisse](https://github.com/cisstech)
