import {
  DiscoveredClassWithMeta,
  DiscoveredMethod,
  DiscoveredMethodWithMeta,
  DiscoveryService,
} from '@golevelup/nestjs-discovery'
import { Test, TestingModule } from '@nestjs/testing'
import {
  DEFAULT_EXPAND_CONFIG,
  EXPANDABLE_KEY,
  EXPANDER_KEY,
  EXPAND_CONFIG,
  ExpandConfig,
  ExpandContext,
  ExpandableParams,
} from './expand'
import { ExpandService } from './expand.service'

class InstructorDTO {
  id!: number
  name!: string
  bio!: string
}

class CourseDTO {
  id!: number
  title!: string
  description!: string
  instructorId!: number
  parentId?: number
  relatedCourseIds?: number[]
}

type ExpandedCourseDTO = CourseDTO & {
  instructor: InstructorDTO
  parent?: CourseDTO
  relatedCourses?: CourseDTO[]
}

const mockCourses: CourseDTO[] = [
  {
    id: 1,
    title: 'Course 1',
    description: 'Course 1 description',
    instructorId: 1,
  },
  {
    id: 2,
    title: 'Course 2',
    description: 'Course 2 description',
    instructorId: 2,
    parentId: 1,
  },
  {
    id: 3,
    title: 'Course 3',
    description: 'Course 3 description',
    instructorId: 3,
    parentId: 1,
    relatedCourseIds: [1, 2],
  },
]

const mockInstructors: InstructorDTO[] = [
  {
    id: 1,
    name: 'Instructor 1',
    bio: 'Instructor 1 bio',
  },
  {
    id: 2,
    name: 'Instructor 2',
    bio: 'Instructor 2 bio',
  },
  {
    id: 3,
    name: 'Instructor 3',
    bio: 'Instructor 3 bio',
  },
]

describe('ExpandService', () => {
  let expandService: ExpandService

  const mockDiscoveryService = {
    providersWithMetaAtKey: jest.fn(),
    methodsAndControllerMethodsWithMetaAtKey: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpandService,
        {
          provide: DiscoveryService,
          useValue: mockDiscoveryService,
        },
        {
          provide: EXPAND_CONFIG,
          useValue: {
            enableLogging: false,
          } as ExpandConfig,
        },
      ],
    }).compile()

    expandService = module.get<ExpandService>(ExpandService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(expandService).toBeDefined()
  })

  it('should load config values', () => {
    expect(expandService.config).toStrictEqual({
      ...DEFAULT_EXPAND_CONFIG,
      enableLogging: false,
    })
  })

  describe('onModuleInit', () => {
    it('should initialize expanders and handle missing providers', async () => {
      const mockExpanders = [
        { meta: CourseDTO, discoveredClass: { instance: jest.fn() } },
      ] as DiscoveredClassWithMeta<jest.Mock>[]

      const mockExpandables = [
        {
          meta: { target: CourseDTO },
          discoveredMethod: { methodName: 'getCourses', parentClass: { name: 'CourseController' } } as DiscoveredMethod,
        },
      ] as DiscoveredMethodWithMeta<ExpandableParams>[]

      // Mock the discovery service behavior
      mockDiscoveryService.providersWithMetaAtKey.mockResolvedValue(mockExpanders)
      mockDiscoveryService.methodsAndControllerMethodsWithMetaAtKey.mockResolvedValue(mockExpandables)

      // Spy on the logger
      const loggerSpy = jest.spyOn(expandService['logger'], 'error')

      // Call the method being tested
      await expandService.onModuleInit()

      // Assertions
      expect(mockDiscoveryService.providersWithMetaAtKey).toHaveBeenCalledWith(EXPANDER_KEY)
      expect(mockDiscoveryService.methodsAndControllerMethodsWithMetaAtKey).toHaveBeenCalledWith(EXPANDABLE_KEY)

      mockExpanders.forEach((expander) => {
        expect(expandService['expanders'].get(expander.meta)).toBe(expander.discoveredClass.instance)
      })

      expect(loggerSpy).not.toHaveBeenCalled() // No errors should be logged
    })

    it('should handle missing providers and log an error', async () => {
      const mockExpandables = [
        {
          meta: { target: { name: 'MyDTO' } },
          discoveredMethod: { methodName: 'missingMethod', parentClass: { name: 'MyController' } },
        },
      ]

      mockDiscoveryService.providersWithMetaAtKey.mockResolvedValue([])
      mockDiscoveryService.methodsAndControllerMethodsWithMetaAtKey.mockResolvedValue(mockExpandables)

      const loggerSpy = jest.spyOn(expandService['logger'], 'error')

      await expect(() => expandService.onModuleInit()).rejects.toThrow()

      expect(mockDiscoveryService.providersWithMetaAtKey).toHaveBeenCalledWith(EXPANDER_KEY)
      expect(mockDiscoveryService.methodsAndControllerMethodsWithMetaAtKey).toHaveBeenCalledWith(EXPANDABLE_KEY)
      expect(loggerSpy.mock.calls[0][0]).toBe(
        'Error during module initialization: Expand: missing providers with @RegisterExpander for : MyDTO used in MyController.missingMethod'
      )
    })
  })

  describe('expand', () => {
    const courseExpander = {
      parent: jest.fn((context: ExpandContext<Request, CourseDTO>) => {
        const { parent } = context
        return parent.parentId ? mockCourses.find((c) => c.id === parent.parentId) : undefined
      }),
      instructor: jest.fn((context: ExpandContext<unknown, CourseDTO>) => {
        return Promise.resolve(mockInstructors.find((i) => i.id === context.parent.instructorId)!)
      }),
      relatedCourses: jest.fn((context: ExpandContext<unknown, CourseDTO>) => {
        return Promise.resolve(mockCourses.filter((c) => context.parent.relatedCourseIds?.includes(c.id)))
      }),
    }
    courseExpander.parent.mockName('parent')
    courseExpander.instructor.mockName('instructor')
    courseExpander.relatedCourses.mockName('relatedCourses')

    beforeEach(async () => {
      const mockExpanders = [
        { meta: CourseDTO, discoveredClass: { instance: courseExpander } },
      ] as DiscoveredClassWithMeta<jest.Mock>[]

      const mockExpandables = [
        {
          meta: { target: CourseDTO },
          discoveredMethod: { methodName: 'getCourses', parentClass: { name: 'CourseController' } } as DiscoveredMethod,
        },
      ] as DiscoveredMethodWithMeta<ExpandableParams>[]

      mockDiscoveryService.providersWithMetaAtKey.mockResolvedValue(mockExpanders)
      mockDiscoveryService.methodsAndControllerMethodsWithMetaAtKey.mockResolvedValue(mockExpandables)

      jest.spyOn(expandService, 'getMethodExpandableMetadata').mockImplementation((method) => {
        return {
          parent: { target: CourseDTO },
        }[(method as jest.Mock).getMockName()]
      })

      await expandService.onModuleInit()
    })

    it('should expand a single entity', async () => {
      const course = mockCourses[0]
      const instructor = mockInstructors.find((i) => i.id === course.instructorId)

      const result = await expandService.expand<ExpandedCourseDTO>({ query: { expands: ['instructor'] } }, course, {
        target: CourseDTO,
      })

      expect(result.instructor).toStrictEqual(instructor)
    })

    it('should expand recursively', async () => {
      const course = mockCourses.find((c) => c.parentId)!
      const parent = mockInstructors.find((i) => i.id === course.parentId)!

      const result = await expandService.expand<ExpandedCourseDTO>(
        { query: { expands: ['parent', 'parent.instructor'] } },
        course,
        { target: CourseDTO }
      )

      expect(result.parent!.id).toStrictEqual(parent.id)
      expect((result.parent as ExpandedCourseDTO).instructor).toBeDefined()
    })
  })
})
