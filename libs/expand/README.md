# @cisstech/nestjs-expand

<div align="center">

A NestJS module to build Dynamic Resource Expansion for APIs

[![CI](https://github.com/cisstech/nestkit/actions/workflows/ci.yml/badge.svg)](https://github.com/cisstech/nestkit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/cisstech/nestkit/branch/main/graph/badge.svg)](https://codecov.io/gh/cisstech/nestkit)
[![codefactor](https://www.codefactor.io/repository/github/cisstech/nestkit/badge/main)](https://www.codefactor.io/repository/github/cisstech/nestkit/overview/main)
[![GitHub Tag](https://img.shields.io/github/tag/cisstech/nestkit.svg)](https://github.com/cisstech/nestkit/tags)
[![npm package](https://img.shields.io/npm/v/@cisstech/nestjs-expand.svg)](https://www.npmjs.org/package/@cisstech/nestjs-expand)
[![NPM downloads](http://img.shields.io/npm/dm/@cisstech/nestjs-expand.svg)](https://npmjs.org/package/@cisstech/nestjs-expand)
[![licence](https://img.shields.io/github/license/cisstech/nestkit)](https://github.com/cisstech/nestkit/blob/main/LICENSE)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

</div>

## Overview

The NestJS Expandable Library is a powerful and flexible extension for NestJS applications, providing a generic pattern for resource expansion in REST APIs. It allows you to dynamically expand and include related resources in API responses, enhancing the flexibility of your API design.

## Features

- Dynamic Resource Expansion: Easily expand related resources in API responses using query parameters.
- Dynamic Field Selection: Easily select only the fields you want to get from the API responses using query parameters.
- Decorator-Based Configuration: Use decorators like `@Expander`, `@Expandable`, `@ExpanderMethods`, and `@UseExpansionMethod` to configure expansion logic.
- Reusable Expansion Logic: Define common expansion logic once in classes decorated with `@ExpanderMethods` and reuse it across multiple DTOs using `@UseExpansionMethod`.
- Enhanced Metadata Handling: Improved handling of metadata allows for multiple decorators of the same type on the same target.
- Configuration and Customization: Configure and customize the library to suit your application's specific needs.
- Comprehensive Error Handling: Control how expansion errors are handled with policies (ignore, include, throw) and response customization.
- Tested and Reliable: Extensive unit and integration tests ensure the reliability of the library.

## Installation

```bash
yarn add @cisstech/nestjs-expand
```

### NestJS Version Compatibility

This library supports both **NestJS v10** and **NestJS v11**:

- ✅ NestJS v10.x
- ✅ NestJS v11.x

## Usage

- 1. Decorate Expandable Endpoints

  ```typescript
  import { Controller, Get } from '@nestjs/common'
  import { CourseService } from './course.service'
  import { CourseDTO } from './course.dto'
  import { Expandable } from '@cisstech/nestjs-expand'

  @Controller('courses')
  export class CourseController {
    constructor(private readonly courseService: CourseService) {}

    @Get()
    @Expandable(CourseDTO)
    async getAllCourses(): Promise<CourseDTO[]> {
      return this.courseService.getAllCourses()
    }
  }
  ```

- 2. Implement Expander Services (`@Expander`)

  ```typescript
  import { Injectable } from '@nestjs/common'
  import { ExpandContext, Expander } from '@cisstech/nestjs-expand'
  import { CourseDTO } from './course.dto'
  import { InstructorDTO } from './instructor.dto'
  import { InstructorService } from './instructor.service'

  @Injectable()
  @Expander(CourseDTO)
  export class CourseExpander {
    constructor(private readonly instructorService: InstructorService) {}

    async instructor(context: ExpandContext<Request, CourseDTO>): Promise<InstructorDTO> {
      const { parent } = context
      const instructor = await this.instructorService.getInstructorById(parent.instructorId)
      if (!instructor) {
        throw new Error(`Instructor with id ${parent.instructorId} not found`)
      }
      return instructor
    }
  }
  ```

- 3. (Optional) Implement Reusable Expansion Logic (`@ExpanderMethods`)

  ```typescript
  // instructor.expander-methods.ts (Example)
  import { Injectable } from '@nestjs/common'
  import { ExpanderMethods } from '@cisstech/nestjs-expand'
  import { InstructorService } from './instructor.service'
  import { InstructorDTO } from './instructor.dto'

  @Injectable()
  @ExpanderMethods() // Mark class containing reusable methods
  export class InstructorExpanderMethods {
    constructor(private readonly instructorService: InstructorService) {}

    async fetchById(id: number): Promise<InstructorDTO | null> {
      return this.instructorService.getInstructorById(id)
    }
  }
  ```

- 4. (Optional) Link Reusable Logic in Standard Expanders (`@UseExpansionMethod`)

  ```typescript
  // course.expander.ts
  import { Injectable } from '@nestjs/common'
  import { Expander, UseExpansionMethod } from '@cisstech/nestjs-expand'
  import { CourseDTO } from './course.dto'
  import { InstructorExpanderMethods } from '../instructors/instructor.expander-methods' // Assuming this class exists

  @Injectable()
  @Expander(CourseDTO)
  @UseExpansionMethod<CourseDTO, InstructorExpanderMethods>({
    name: 'instructor', // Field to populate
    class: InstructorExpanderMethods, // Class with reusable logic
    method: 'fetchById', // Method to call
    params: ['instructorId'], // Map parent.instructorId to the method's first arg
  })
  export class CourseExpander {
    // No instructor method needed here if using @UseExpansionMethod
  }
  ```

- 5. Register the controllers and providers (Expanders, ExpanderMethods classes)

```typescript
// app.module.ts

import { Module } from '@nestjs/common'
import { NestKitExpandModule } from '@cisstech/nestjs-expand'
import { CourseController } from 'PATH_TO_FILE'
import { CourseExpander } from 'PATH_TO_FILE'
import { InstructorExpanderMethods } from 'PATH_TO_FILE' // Register the class with reusable methods

@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: true,
      errorHandling: {
        includeErrorsInResponse: true,
        defaultErrorPolicy: 'ignore',
      },
    }),
  ],
  controllers: [CourseController],
  providers: [CourseExpander, InstructorExpanderMethods], // Add all expander/methods classes
})
export class AppModule {}
```

## Configuration Options

The library provides configuration options to customize its behavior. You can pass an optional configuration object when initializing the NestKitExpandModule in your module:

```typescript
NestKitExpandModule.forRoot({
  // General configuration
  enableLogging: true, // Enable or disable logging
  enableGlobalSelection: true, // Make all endpoints selectable by default
  expandQueryParamName: 'expands', // The query parameter name for expansions
  selectQueryParamName: 'selects', // The query parameter name for field selection
  logLevel: 'warn', // Log level: 'debug', 'log', 'warn', 'error', or 'none'

  // Error handling configuration
  errorHandling: {
    includeErrorsInResponse: true, // Include error details in the response
    defaultErrorPolicy: 'ignore', // Default error policy: 'ignore', 'include', or 'throw'
    errorResponseShape: (error, path) => ({
      // Customize the error shape
      message: `Error in ${path}: ${error.message}`,
      path: path,
      code: error.code || 'EXPANSION_ERROR',
    }),
  },
})
```

## Error Handling Policies

You can control how expansion errors are handled at both the module and endpoint levels:

- `ignore` (default): Continue with other expansions, but don't include the failed expansion
- `include`: Include error details in the response for debugging (requires `includeErrorsInResponse: true`)
- `throw`: Fail the entire request if any expansion fails

Example with per-endpoint error policy:

```typescript
@Get('users')
@Expandable(UserDTO, { errorPolicy: 'include' })
findAll() {
  return this.userService.findAll();
}
```

## Documentation

For detailed documentation, examples, and advanced usage, please refer to the official documentation at <https://cisstech.github.io/nestkit/docs/nestjs-expand/getting-started>

A presentation article is also available [medium](https://medium.com/p/08c06be4c2ba)

## License

MIT © [Mamadou Cisse](https://github.com/cisstech)
