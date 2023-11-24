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
    const instructor = this.instructors.find((i) => i.id === instructorId)
    return Promise.resolve(instructor)
  }
}
