# Advanced Usage

## Module Configuration Options

The library provides configuration options to customize its behavior. You can pass an optional configuration object when initializing the NestKitExpandModule in your module. The config object is fully documented.

```typescript
// app.module.ts

import { Module } from '@nestjs/common'
import { NestKitExpandModule } from '@cisstech/nestjs-expand'
import { UserExpander } from 'FILE_PATH'
import { UserController } from 'FILE_PATH'

@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: true,
      enableGlobalSelection: true,
      expandQueryParamName: 'expands',
      selectQueryParamName: 'selects',
      logLevel: 'warn', // 'debug', 'log', 'warn', 'error', or 'none'
      errorHandling: {
        includeErrorsInResponse: true,
        defaultErrorPolicy: 'ignore',
        errorResponseShape: (error, path) => ({
          message: error.message,
          path: path,
        }),
      },
    }),
  ],
  controllers: [UserController],
  providers: [UserExpander],
})
export class AppModule {}
```

## Controller Configuration Options

In some situations, it's useful to override the global configurations on the controller layer:

- `expandQueryParamName`: If some endpoints already use your global expandQueryParamName query param, you can override it as follows:

```typescript
// course.controller.ts

import { Controller, Get } from '@nestjs/common'
import { CourseService } from './course.service'
import { CourseDTO } from './course.dto'
import { Expandable } from '@cisstech/nestjs-expand'

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @Expandable(CourseDTO, {
    queryParamName: 'myCustomQueryParam',
  })
  async getAllCourses(): Promise<CourseDTO[]> {
    return this.courseService.getAllCourses()
  }
}
```

- `selectQueryParamName`: The same option as for expandQueryParamName to override the global selectQueryParamName query param.

```typescript
// course.controller.ts

import { Controller, Get } from '@nestjs.common'
import { CourseService } from './course.service'
import { CourseDTO } from './course.dto'
import { Expandable } from '@cisstech/nestjs-expand'

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @Selectable({
    queryParamName: 'myCustomQueryParam',
  })
  async getAllCourses(): Promise<CourseDTO[]> {
    return this.courseService.getAllCourses()
  }
}
```

- `rootField`: In some situations, you may wrap your response with an object containing other information like total, nextPage and put the DTO inside a field like items. To address such situations, you can use the rootField property on both `@Selectable` and `@Expandable` decorators.

```typescript
// course.controller.ts

import { Controller, Get } from '@nestjs.common'
import { CourseService } from './course.service'
import { CourseDTO } from './course.dto'
import { Expandable, Selectable } from '@cisstech/nestjs-expand'

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @Expandable(CourseDTO, {
    rootField: 'items',
  })
  @Selectable({ rootField: 'items' })
  async getAllCourses(): Promise<{ items: CourseDTO[]; total: number }> {
    const [courses, total] = await this.courseService.getAllCourses()
    return {
      total,
      items: courses,
    }
  }
}
```

## Error Handling

The library provides comprehensive error handling capabilities for expansions. You can control how errors are handled using policies, customize error messages, and include error details in responses.

### Error Policies

Three error policies are available:

- `ignore` (default): When an expansion fails, it's silently ignored and the request continues
- `include`: Expansion errors are attached to the response for debugging
- `throw`: If any expansion fails, the entire request fails with an error

You can set a default policy at the module level and override it per endpoint:

```typescript
// Module level setting
NestKitExpandModule.forRoot({
  errorHandling: {
    defaultErrorPolicy: 'include',
    includeErrorsInResponse: true
  }
})

// Endpoint level override
@Get()
@Expandable(UserDTO, { errorPolicy: 'throw' })
findAll() {
  return this.userService.findAll();
}
```

### Including Error Details in Responses

When `includeErrorsInResponse` is set to `true`, error details are included in the response:

```typescript
// For single objects
{
  "id": 1,
  "name": "John",
  "_expansionErrors": {
    "UserDTO.profile": {
      "message": "Profile not found",
      "path": "UserDTO.profile"
    }
  }
}

// For collections, errors are attached to individual items
[
  {
    "id": 1,
    "name": "John",
    "_expansionErrors": {
      "UserDTO.failingExpander": {
        "message": "This expander always fails",
        "path": "UserDTO.failingExpander[0]"
      }
    }
  },
  {
    "id": 2,
    "name": "Jane",
    "_expansionErrors": {
      "UserDTO.profile": {
        "message": "Profile not found",
        "path": "UserDTO.profile[1]"
      }
    }
  }
]
```

### Customizing Error Format

You can customize the format of error details using the `errorResponseShape` function:

```typescript
NestKitExpandModule.forRoot({
  errorHandling: {
    includeErrorsInResponse: true,
    errorResponseShape: (error, path) => ({
      message: `Custom format: ${error.message}`,
      path: path,
      code: error instanceof HttpException ? error.getStatus() : 'UNKNOWN',
      timestamp: new Date().toISOString(),
    }),
  },
})
```

## Query Language

This library comes with a powerful query language that allows expanding and selecting resource fields using query params.

- Expand Nested Resources

```bash
GET /courses?expands=instructor,parent.instructor,instructor.address
```

- Select Specific Properties

```bash
GET /courses?expands=instructor,parent&selects=id,title,instructor.name,parent.title
```

- Use Wildcard and Minus Operators

Wildcard operator `*` allows selecting all fields on the current level of your dot notation.
Minus operator `-` allows excluding some fields combined with `*` or without.

```bash
GET /courses?expands=instructor,parent&selects=*,-description,instructor.*,-instructor.id,-instructor.bio,parent.title
```

This query is translated into

```typescript
{
  '*': true, // select all fields from root
  description: false, // exclude description field
  instructor: {
    '*': true, // select all fields of the instructor
    id: false, // exclude id field
    bio: false // exclude bio field
  },
  parent: {
    title: true // select only title field of the parent
  }
}
```
