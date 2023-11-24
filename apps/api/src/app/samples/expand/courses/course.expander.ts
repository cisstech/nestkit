import { ExpandContext, Expander } from '@cisstech/nestjs-expand'
import { Injectable } from '@nestjs/common'
import { InstructorDTO } from '../instructors/instructor.dto'
import { InstructorService } from '../instructors/instructor.service'
import { CourseDTO } from './course.dto'

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
