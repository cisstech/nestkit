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
