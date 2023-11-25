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

import { Controller, Get } from '@nestjs/common'
import { CourseService } from './course.service'
import { CourseDTO } from './course.dto'
import { Expandable } from '@cisstech/nestjs-expand'

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @Selectable(CourseDTO, {
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

import { Controller, Get } from '@nestjs/common'
import { CourseService } from './course.service'
import { CourseDTO } from './course.dto'
import { Expandable } from '@cisstech/nestjs-expand'

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @Selectable(CourseDTO, {
    rootField: 'items',
  })
  async getAllCourses(): Promise<{ items: CourseDTO[]; total: number }> {
    const [courses, total] = await this.courseService.getAllCourses()
    return {
      total,
      items: courses,
    }
  }
}
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
