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

## Define Expanders (`@Expander`)

An expander is a simple NestJS service decorated with `@Expander` decorator. It contains methods specific to expanding fields for a particular DTO.

```typescript
// course.expander.ts

import { Injectable } from '@nestjs/common'
import { ExpandContext, Expander, Expandable } from '@cisstech/nestjs-expand' // Corrected import path
import { CourseDTO } from './course.dto'
import { InstructorDTO } from '../instructors/instructor.dto' // Corrected path
import { InstructorService } from '../instructors/instructor.service' // Corrected path

@Injectable()
@Expander(CourseDTO)
export class CourseExpander {
  constructor(private readonly instructorService: InstructorService) {}

  // This method might be replaced by @UseExpansionMethod if logic is reusable
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

## Define Reusable Expansion Logic (`@ExpanderMethods`)

For common expansion logic (like fetching a user), create a separate injectable class decorated with `@ExpanderMethods`.

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

  // Method to be reused
  async fetchById(id: number): Promise<InstructorDTO | null> {
    // Add robust error handling as needed
    return this.instructorService.getInstructorById(id)
  }
}
```

## Link Reusable Logic (`@UseExpansionMethod`)

In your standard `@Expander` class, use the `@UseExpansionMethod` decorator at the class level to link a field to a method in your `@ExpanderMethods` class.

```typescript
// course.expander.ts (Updated)
import { Injectable } from '@nestjs/common'
import { Expander, UseExpansionMethod } from '@cisstech/nestjs-expand'
import { CourseDTO } from './course.dto'
import { InstructorExpanderMethods } from '../instructors/instructor.expander-methods'

@Injectable()
@Expander(CourseDTO)
@UseExpansionMethod<CourseDTO, InstructorExpanderMethods>({
  name: 'instructor', // Field to populate in CourseDTO
  class: InstructorExpanderMethods, // The class containing the reusable logic
  method: 'fetchById', // The method to call in InstructorExpanderMethods
  params: ['instructorId'], // Map CourseDTO.instructorId to the first argument of fetchById
  // For complex cases: params: (context) => [context.parent.instructorId, context.request.headers['x-tenant']]
})
export class CourseExpander {
  // No need for the 'instructor' method here anymore!
  // Constructor can be empty if no other dependencies or standard methods are needed.
  constructor() {}
}
```

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

## Import NestKitExpandModule and Register Providers

Ensure all `@Expander` and `@ExpanderMethods` classes are registered as providers in your module.

```typescript
// app.module.ts

import { Module } from '@nestjs/common'
import { NestKitExpandModule } from '@cisstech/nestjs-expand'
import { CourseController } from 'PATH_TO_FILE'
import { CourseService } from 'PATH_TO_FILE'
import { InstructorService } from 'PATH_TO_FILE'
import { CourseExpander } from 'PATH_TO_FILE'
import { InstructorExpanderMethods } from 'PATH_TO_FILE' // Register the reusable methods class

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
  providers: [
    CourseService,
    InstructorService,
    CourseExpander, // Register standard expander
    InstructorExpanderMethods, // Register class with reusable methods
  ],
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
