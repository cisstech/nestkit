import { Controller, Get, INestApplication, Injectable, Module, Param } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { ExpandContext, Expandable, Expander, Selectable } from './expand'
import { NestKitExpandModule } from './expand.module'

//#region DTOs
class InstructorDTO {
  id!: number
  name!: string
  bio!: string
  departmentId?: number
}

class DepartmentDTO {
  id!: number
  name!: string
  schoolId?: number
}

class SchoolDTO {
  id!: number
  name!: string
  location!: string
}

class CourseDTO {
  id!: number
  title!: string
  description!: string
  instructorId!: number
  departmentId?: number
}
//#endregion

//#region Mock data
const mockSchools: SchoolDTO[] = [
  { id: 1, name: 'School of Engineering', location: 'North Campus' },
  { id: 2, name: 'School of Business', location: 'South Campus' },
]

const mockDepartments: DepartmentDTO[] = [
  { id: 101, name: 'Computer Science', schoolId: 1 },
  { id: 102, name: 'Electrical Engineering', schoolId: 1 },
  { id: 201, name: 'Marketing', schoolId: 2 },
]

const mockInstructors: InstructorDTO[] = [
  { id: 1, name: 'John Smith', bio: 'Professor of Computer Science', departmentId: 101 },
  { id: 2, name: 'Jane Doe', bio: 'Professor of Marketing', departmentId: 201 },
  { id: 3, name: 'Bob Johnson', bio: 'Professor of Engineering', departmentId: 102 },
]

const mockCourses: CourseDTO[] = [
  {
    id: 1,
    title: 'Introduction to Programming',
    description: 'Learn the basics of programming',
    instructorId: 1,
    departmentId: 101,
  },
  {
    id: 2,
    title: 'Advanced Marketing',
    description: 'Strategic marketing concepts',
    instructorId: 2,
    departmentId: 201,
  },
  {
    id: 3,
    title: 'Electrical Circuits',
    description: 'Understanding electrical circuits',
    instructorId: 3,
    departmentId: 102,
  },
]
//#endregion

//#region Service implementations
@Injectable()
class CourseService {
  findAll(): CourseDTO[] {
    return mockCourses
  }

  findById(id: number): CourseDTO | undefined {
    return mockCourses.find((c) => c.id === id)
  }
}

@Injectable()
class InstructorService {
  findById(id: number): InstructorDTO | undefined {
    return mockInstructors.find((i) => i.id === id)
  }
}

@Injectable()
class DepartmentService {
  findById(id: number): DepartmentDTO | undefined {
    return mockDepartments.find((d) => d.id === id)
  }
}

@Injectable()
class SchoolService {
  findById(id: number): SchoolDTO | undefined {
    return mockSchools.find((s) => s.id === id)
  }
}
//#endregion

//#region Expanders
@Injectable()
@Expander(CourseDTO)
class CourseExpander {
  constructor(
    private readonly instructorService: InstructorService,
    private readonly departmentService: DepartmentService
  ) {}

  @Expandable(InstructorDTO)
  async instructor(context: ExpandContext<Request, CourseDTO>): Promise<InstructorDTO | undefined> {
    return this.instructorService.findById(context.parent.instructorId)
  }

  @Expandable(DepartmentDTO)
  async department(context: ExpandContext<Request, CourseDTO>): Promise<DepartmentDTO | undefined> {
    if (!context.parent.departmentId) return undefined
    return this.departmentService.findById(context.parent.departmentId)
  }
}

@Injectable()
@Expander(InstructorDTO)
class InstructorExpander {
  constructor(private readonly departmentService: DepartmentService) {}

  @Expandable(DepartmentDTO)
  async department(context: ExpandContext<Request, InstructorDTO>): Promise<DepartmentDTO | undefined> {
    if (!context.parent.departmentId) return undefined
    return this.departmentService.findById(context.parent.departmentId)
  }
}

@Injectable()
@Expander(DepartmentDTO)
class DepartmentExpander {
  constructor(private readonly schoolService: SchoolService) {}

  @Expandable(SchoolDTO)
  async school(context: ExpandContext<Request, DepartmentDTO>): Promise<SchoolDTO | undefined> {
    if (!context.parent.schoolId) return undefined
    return this.schoolService.findById(context.parent.schoolId)
  }
}
//#endregion

//#region Controllers
@Controller('courses')
class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @Expandable(CourseDTO)
  @Selectable()
  findAll() {
    return this.courseService.findAll()
  }

  @Get('paged')
  @Expandable(CourseDTO, { rootField: 'items' })
  @Selectable({ rootField: 'items' })
  findPaged() {
    return {
      items: this.courseService.findAll(),
      total: mockCourses.length,
      page: 1,
      pageSize: 10,
    }
  }

  @Get('custom-params')
  @Expandable(CourseDTO, { queryParamName: 'include' })
  @Selectable({ queryParamName: 'fields' })
  findWithCustomParams() {
    return this.courseService.findAll()
  }

  @Get(':id')
  @Expandable(CourseDTO)
  @Selectable()
  findById(@Param('id') id: string) {
    return this.courseService.findById(parseInt(id, 10))
  }
}
//#endregion

//#region Test Module
@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: false,
      enableGlobalSelection: true,
    }),
  ],
  controllers: [CourseController],
  providers: [
    CourseService,
    InstructorService,
    DepartmentService,
    SchoolService,
    CourseExpander,
    InstructorExpander,
    DepartmentExpander,
  ],
})
class TestModule {}
//#endregion

describe('NestKitExpand Integration Tests', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Basic Expansion', () => {
    it('should return courses without expansion', async () => {
      const response = await request(app.getHttpServer()).get('/courses')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockCourses)
    })

    it('should expand instructor field', async () => {
      const response = await request(app.getHttpServer()).get('/courses?expands=instructor')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(mockCourses.length)
      expect(response.body[0].instructor).toEqual(mockInstructors[0])
    })

    it('should expand department field', async () => {
      const response = await request(app.getHttpServer()).get('/courses?expands=department')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(mockCourses.length)
      expect(response.body[0].department).toEqual(mockDepartments[0])
    })
  })

  describe('Nested Expansion', () => {
    it('should expand nested fields (instructor.department)', async () => {
      const response = await request(app.getHttpServer()).get('/courses?expands=instructor,instructor.department')

      expect(response.status).toBe(200)
      expect(response.body[0].instructor.department).toEqual(mockDepartments[0])
    })

    it('should expand deeply nested fields (instructor.department.school)', async () => {
      const response = await request(app.getHttpServer()).get(
        '/courses?expands=instructor,instructor.department,instructor.department.school'
      )

      expect(response.status).toBe(200)
      expect(response.body[0].instructor.department.school).toEqual(mockSchools[0])
    })

    it('should expand multiple paths (department,instructor.department)', async () => {
      const response = await request(app.getHttpServer()).get(
        '/courses?expands=department,instructor,instructor.department'
      )

      expect(response.status).toBe(200)
      expect(response.body[0].department).toEqual(mockDepartments[0])
      expect(response.body[0].instructor.department).toEqual(mockDepartments[0])
    })
  })

  describe('Field Selection', () => {
    it('should select specific fields only', async () => {
      const response = await request(app.getHttpServer()).get('/courses?selects=id,title')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(mockCourses.length)
      expect(Object.keys(response.body[0])).toEqual(['id', 'title'])
      expect(response.body[0].id).toBe(mockCourses[0].id)
      expect(response.body[0].title).toBe(mockCourses[0].title)
      expect(response.body[0].description).toBeUndefined()
    })

    it('should select fields from expanded objects', async () => {
      const response = await request(app.getHttpServer()).get(
        '/courses?expands=instructor&selects=id,title,instructor.name'
      )

      expect(response.status).toBe(200)
      expect(Object.keys(response.body[0])).toEqual(['id', 'title', 'instructor'])
      expect(Object.keys(response.body[0].instructor)).toEqual(['name'])
      expect(response.body[0].instructor.bio).toBeUndefined()
    })

    it('should support wildcard operator', async () => {
      const response = await request(app.getHttpServer()).get('/courses?expands=instructor&selects=*,instructor.name')

      expect(response.status).toBe(200)
      expect(Object.keys(response.body[0])).toContain('id')
      expect(Object.keys(response.body[0])).toContain('title')
      expect(Object.keys(response.body[0])).toContain('description')
      expect(Object.keys(response.body[0].instructor)).toEqual(['name'])
    })

    it('should support exclusion with minus operator', async () => {
      const response = await request(app.getHttpServer()).get('/courses?selects=*,-description')

      expect(response.status).toBe(200)
      expect(Object.keys(response.body[0])).not.toContain('description')
      expect(Object.keys(response.body[0])).toContain('id')
      expect(Object.keys(response.body[0])).toContain('title')
    })
  })

  describe('Root Field Handling', () => {
    it('should handle expansion with root field', async () => {
      const response = await request(app.getHttpServer()).get('/courses/paged?expands=instructor')

      expect(response.status).toBe(200)
      expect(response.body.items).toBeDefined()
      expect(response.body.total).toBe(mockCourses.length)
      expect(response.body.items[0].instructor).toBeDefined()
      expect(response.body.items[0].instructor.name).toBe(mockInstructors[0].name)
    })

    it('should handle selection with root field', async () => {
      const response = await request(app.getHttpServer()).get('/courses/paged?selects=id,title')

      expect(response.status).toBe(200)
      expect(response.body.items).toBeDefined()
      expect(response.body.total).toBe(mockCourses.length)
      expect(Object.keys(response.body.items[0])).toEqual(['id', 'title'])
    })
  })

  describe('Custom Query Parameters', () => {
    it('should use custom query parameter names', async () => {
      const response = await request(app.getHttpServer()).get(
        '/courses/custom-params?include=instructor&fields=id,title,instructor.name'
      )

      expect(response.status).toBe(200)
      expect(response.body[0].instructor).toBeDefined()
      expect(Object.keys(response.body[0])).toEqual(['id', 'title', 'instructor'])
      expect(Object.keys(response.body[0].instructor)).toEqual(['name'])
    })
  })

  describe('Single Resource Endpoints', () => {
    it('should expand a single resource', async () => {
      const response = await request(app.getHttpServer()).get('/courses/1?expands=instructor,department')

      expect(response.status).toBe(200)
      expect(response.body.id).toBe(1)
      expect(response.body.instructor).toEqual(mockInstructors[0])
      expect(response.body.department).toEqual(mockDepartments[0])
    })

    it('should select fields from a single resource', async () => {
      const response = await request(app.getHttpServer()).get('/courses/1?selects=id,title')

      expect(response.status).toBe(200)
      expect(Object.keys(response.body)).toEqual(['id', 'title'])
    })
  })
})
