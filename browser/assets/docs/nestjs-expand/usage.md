# Usage

## Define DTOs

```typescript
// course.dto.ts

export class CourseDTO {
  id: number
  title: string
  description: string
  instructorId: number
}
```

```typescript
// instructor.dto.ts

export class InstructorDTO {
  id: number
  name: string
  bio: string
}
```

## Define Controller

The expandable endpoints are marked with the `@Expandable` decorator

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
  @Expandable(CourseDTO)
  async getAllCourses(): Promise<CourseDTO[]> {
    return this.courseService.getAllCourses()
  }
}
```

## Define Expanders

An expander is a simple NestJS service decorated with `@Expander` decorator

```typescript
// course.expander.ts

import { Injectable } from '@nestjs/common'
import { ExpandContext, Expander, Expandable } from 'nestjs-expandable'
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

:::+ Multiple Expanders
You can define as many expanders as needed for the same DTO.
:::

## Define Services

```typescript
// course.service.ts

import { Injectable } from '@nestjs/common'
import { CourseDTO } from './course.dto'

@Injectable()
export class CourseService {
  private readonly courses: CourseDTO[] = [
    { id: 1, title: 'Introduction to Programming', description: 'Learn the basics of programming.', instructorId: 101 },
    {
      id: 2,
      title: 'Web Development Fundamentals',
      description: 'Explore the world of web development.',
      instructorId: 102,
    },
    // ... more courses
  ]

  getAllCourses(): Promise<CourseDTO[]> {
    return Promise.resolve(this.courses)
  }
}
```

```typescript
// instructor.service.ts

import { Injectable } from '@nestjs/common'
import { InstructorDTO } from './instructor.dto'

@Injectable()
export class InstructorService {
  private readonly instructors: InstructorDTO[] = [
    { id: 101, name: 'John Doe', bio: 'Passionate about teaching programming concepts.' },
    { id: 102, name: 'Jane Smith', bio: 'Experienced web developer and instructor.' },
    // ... more instructors
  ]

  getInstructorById(instructorId: number): Promise<InstructorDTO | undefined> {
    return Promise.resolve(this.instructors.find((i) => i.id === instructorId))
  }
}
```

## Import NestKitExpandModule in your AppModule

```typescript
// app.module.ts

import { Module } from '@nestjs/common'
import { NestKitExpandModule } from '@cisstech/nestjs-expand'
import { CourseController } from 'PATH_TO_FILE'
import { CourseService } from 'PATH_TO_FILE'
import { InstructorService } from 'PATH_TO_FILE'
import { CourseExpander } from 'PATH_TO_FILE'

@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: true,
      enableGlobalSelection: true,
      expandQueryParamName: 'expands',
      selectQueryParamName: 'selects',
    }),
  ],
  controllers: [CourseController],
  providers: [CourseService, InstructorService, CourseExpander],
})
export class AppModule {}
```

Sample API Call Result:

- Endpoint: `GET /courses`
- Output:

```json
{
  "courses": [
    {
      "id": 1,
      "title": "Introduction to Programming",
      "description": "Learn the basics of programming.",
      "instructorId": 101
    },
    {
      "id": 2,
      "title": "Web Development Fundamentals",
      "description": "Explore the world of web development.",
      "instructorId": 102
    }
    // ... more courses
  ]
}
```

- Endpoint: `GET /courses?expands=instructor`
- Output:

```json
{
  "courses": [
    {
      "id": 1,
      "title": "Introduction to Programming",
      "description": "Learn the basics of programming.",
      "instructorId": 101,
      "instructor": {
        "id": 101,
        "name": "John Doe",
        "bio": "Passionate about teaching programming concepts."
      }
    },
    {
      "id": 2,
      "title": "Web Development Fundamentals",
      "description": "Explore the world of web development.",
      "instructorId": 102,
      "instructor": {
        "id": 102,
        "name": "Jane Smith",
        "bio": "Experienced web developer and instructor."
      }
    }
    // ... more courses
  ]
}
```
