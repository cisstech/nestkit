import { Expandable } from '@cisstech/nestjs-expand'
import { Controller, Get, Header } from '@nestjs/common'
import { ApiQuery, ApiTags } from '@nestjs/swagger'
import { CourseDTO } from './course.dto'
import { CourseService } from './course.service'

@ApiTags('nestjs-expand')
@Controller('expansion/courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @ApiQuery({
    name: 'expands',
    required: false,
    isArray: true,
    enum: ['instructor'],
    description: 'The related entities to expand.',
  })
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Expandable(CourseDTO)
  async getAllCourses(): Promise<CourseDTO[]> {
    return this.courseService.getAllCourses()
  }
}
