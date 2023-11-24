import { NestKitExpandModule } from '@cisstech/nestjs-expand'
import { Module } from '@nestjs/common'
import { CourseController } from './courses/course.controller'
import { CourseExpander } from './courses/course.expander'
import { CourseService } from './courses/course.service'
import { InstructorService } from './instructors/instructor.service'

@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: true,
    }),
  ],
  controllers: [CourseController],
  providers: [CourseService, InstructorService, CourseExpander],
})
export class ExpandSampleModule {}
