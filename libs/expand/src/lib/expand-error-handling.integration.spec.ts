/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, HttpException, HttpStatus, INestApplication, Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { ExpandContext, Expandable, Expander, Selectable } from './expand'
import { NestKitExpandModule } from './expand.module'

//#region DTOs
class UserDTO {
  id!: number
  name!: string
  email!: string
  profileId?: number
}

class ProfileDTO {
  id!: number
  bio?: string
  avatar?: string
}
//#endregion

//#region Mock data
const mockUsers: UserDTO[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', profileId: 1 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', profileId: undefined },
]

const mockProfiles: ProfileDTO[] = [{ id: 1, bio: 'Software developer', avatar: 'avatar1.jpg' }]
//#endregion

//#region Service implementations
@Injectable()
class UserService {
  findAll(): UserDTO[] {
    return mockUsers
  }
}

@Injectable()
class ProfileService {
  findById(id: number): ProfileDTO | undefined {
    return mockProfiles.find((p) => p.id === id)
  }
}
//#endregion

//#region Error throwing expander
@Injectable()
@Expander(UserDTO)
class UserExpander {
  constructor(private readonly profileService: ProfileService) {}

  async profile(context: ExpandContext<Request, UserDTO>): Promise<ProfileDTO | undefined> {
    // Simulate an error for a specific user
    if (context.parent.id === 2) {
      throw new HttpException('Profile not found', HttpStatus.NOT_FOUND)
    }

    // For other users, try to get their profile
    if (!context.parent.profileId) return undefined

    return this.profileService.findById(context.parent.profileId)
  }

  async failingExpander(): Promise<any> {
    throw new Error('This expander always fails')
  }

  async delayedProfile(context: ExpandContext<Request, UserDTO>): Promise<ProfileDTO | undefined> {
    // Simulate a slow request
    await new Promise((resolve) => setTimeout(resolve, 100))

    if (!context.parent.profileId) return undefined
    return this.profileService.findById(context.parent.profileId)
  }
}
//#endregion

//#region Controllers
@Controller('users')
class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Expandable(UserDTO)
  @Selectable()
  findAll() {
    return this.userService.findAll()
  }

  @Get('ignore-error')
  @Expandable(UserDTO, { errorPolicy: 'ignore' })
  findWithIgnoreError() {
    return this.userService.findAll()
  }

  @Get('include-error')
  @Expandable(UserDTO, { errorPolicy: 'include' })
  findWithIncludeError() {
    return this.userService.findAll()
  }

  @Get('throw-error')
  @Expandable(UserDTO, { errorPolicy: 'throw' })
  findWithThrowError() {
    return this.userService.findAll()
  }

  @Get('error')
  @Expandable(UserDTO)
  findWithError() {
    throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR)
  }

  @Get('paginated')
  @Expandable(UserDTO, { rootField: 'items' })
  @Selectable({ rootField: 'items' })
  findPaginated() {
    return {
      items: this.userService.findAll(),
      total: mockUsers.length,
      page: 1,
      pageSize: 10,
    }
  }

  @Get('paginated-single')
  @Expandable(UserDTO, { rootField: 'item' })
  findPaginatedSingle() {
    return {
      item: mockUsers[1], // User with ID 2 (will cause profile error)
      metadata: { timestamp: new Date() },
    }
  }
}
//#endregion

// Test Module with different error handling configurations
@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: false,
      errorHandling: {
        includeErrorsInResponse: true,
        errorResponseShape: (error, path) => ({
          message: `Custom error format: ${error.message}`,
          path,
        }),
      },
    }),
  ],
  controllers: [UserController],
  providers: [UserService, ProfileService, UserExpander],
})
class TestErrorModule {}

describe('NestKitExpand Error Handling Integration Tests', () => {
  let app: INestApplication
  let originalConsoleError: any

  beforeAll(async () => {
    // Suppress console error outputs during tests
    originalConsoleError = console.error
    console.error = jest.fn()

    const moduleRef = await Test.createTestingModule({
      imports: [TestErrorModule],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    console.error = originalConsoleError
    await app.close()
  })

  describe('Error Handling Policies', () => {
    it('should include error metadata in response with "include" policy', async () => {
      const response = await request(app.getHttpServer()).get('/users/include-error?expands=profile,failingExpander')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(mockUsers.length)

      //// First user should expand profile but not failingExpander
      expect(response.body[0].profile).toEqual(mockProfiles[0])
      expect(response.body[0]._expansionErrors).toBeDefined()
      expect(response.body[0]._expansionErrors['UserDTO.failingExpander']).toBeDefined()

      //// Second user's profile expansion should fail
      expect(response.body[1].profile).toBeUndefined()
      expect(response.body[1]._expansionErrors).toBeDefined()
      expect(response.body[1]._expansionErrors['UserDTO.profile']).toBeDefined()
      expect(response.body[1]._expansionErrors['UserDTO.failingExpander']).toBeDefined()

      // Check if error message is correctly formatted
      expect(response.body[1]._expansionErrors['UserDTO.failingExpander'].message).toContain('Custom error format:')
    })

    it('should process expansions but ignore errors with "ignore" policy', async () => {
      const response = await request(app.getHttpServer()).get('/users/ignore-error?expands=profile,failingExpander')

      expect(response.status).toBe(200)

      // User 1 should have profile expanded
      expect(response.body[0].profile).toBeDefined()

      // User 2's profile expansion failed but should be undefined
      expect(response.body[1].profile).toBeUndefined()

      // failingExpander should be ignored for both users
      expect(response.body[0].failingExpander).toBeUndefined()
      expect(response.body[1].failingExpander).toBeUndefined()
    })

    it('should throw error with "throw" policy', async () => {
      const response = await request(app.getHttpServer()).get('/users/throw-error?expands=failingExpander')

      // Should result in a 500 error as the failingExpander will throw an error
      expect(response.status).toBe(500)
    })

    it('should not attempt expansion when controller returns error status code', async () => {
      const response = await request(app.getHttpServer()).get('/users/error?expands=profile')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Internal server error')
    })
  })

  describe('Default Error Behavior', () => {
    it('should include error metadata for default expansions', async () => {
      const response = await request(app.getHttpServer()).get('/users?expands=profile,failingExpander')

      expect(response.status).toBe(200)

      // The default policy is 'ignore' but we've configured includeErrorsInResponse:true

      //// First user should expand profile but not failingExpander
      expect(response.body[0].profile).toEqual(mockProfiles[0])
      expect(response.body[0]._expansionErrors).toBeDefined()
      expect(response.body[0]._expansionErrors['UserDTO.failingExpander']).toBeDefined()

      //// Second user's profile expansion should fail
      expect(response.body[1].profile).toBeUndefined()
      expect(response.body[1]._expansionErrors).toBeDefined()
      expect(response.body[1]._expansionErrors['UserDTO.profile']).toBeDefined()
      expect(response.body[1]._expansionErrors['UserDTO.failingExpander']).toBeDefined()
    })
  })

  describe('Array Response Error Handling', () => {
    it('should attach errors directly to specific array items', async () => {
      const response = await request(app.getHttpServer()).get('/users?expands=profile')

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)

      // First user should have profile expanded successfully
      expect(response.body[0].profile).toBeDefined()
      expect(response.body[0].profile.bio).toBe('Software developer')

      // Second user (index 1) should have the expansion error in its own _expansionErrors property
      expect(response.body[1].profile).toBeUndefined()
      expect(response.body[1]._expansionErrors).toBeDefined()
      expect(response.body[1]._expansionErrors['UserDTO.profile']).toBeDefined()
      expect(response.body[1]._expansionErrors['UserDTO.profile'].message).toContain(
        'Custom error format: Profile not found'
      )
    })

    it('should handle multiple errors on different array items', async () => {
      const response = await request(app.getHttpServer()).get('/users?expands=profile,failingExpander')

      expect(response.status).toBe(200)

      // First item should have profile but not failingExpander
      expect(response.body[0].profile).toBeDefined()
      expect(response.body[0].failingExpander).toBeUndefined()
      expect(response.body[0]._expansionErrors).toBeDefined()
      expect(response.body[0]._expansionErrors['UserDTO.failingExpander']).toBeDefined()

      // Second item should have both profile and failingExpander errors
      expect(response.body[1].profile).toBeUndefined()
      expect(response.body[1].failingExpander).toBeUndefined()
      expect(response.body[1]._expansionErrors).toBeDefined()
      expect(response.body[1]._expansionErrors['UserDTO.profile']).toBeDefined()
      expect(response.body[1]._expansionErrors['UserDTO.failingExpander']).toBeDefined()
    })
  })

  describe('RootField Error Handling', () => {
    it('should attach errors to items within rootField array', async () => {
      const response = await request(app.getHttpServer()).get('/users/paginated?expands=profile,failingExpander')

      expect(response.status).toBe(200)
      expect(response.body.items).toBeDefined()
      expect(response.body.total).toBe(mockUsers.length)

      // First user in items should have profile but failingExpander error
      expect(response.body.items[0].profile).toBeDefined()
      expect(response.body.items[0].failingExpander).toBeUndefined()
      expect(response.body.items[0]._expansionErrors).toBeDefined()
      expect(response.body.items[0]._expansionErrors['UserDTO.failingExpander']).toBeDefined()

      // Second user in items should have both profile and failingExpander errors
      expect(response.body.items[1].profile).toBeUndefined()
      expect(response.body.items[1].failingExpander).toBeUndefined()
      expect(response.body.items[1]._expansionErrors).toBeDefined()
      expect(response.body.items[1]._expansionErrors['UserDTO.profile']).toBeDefined()
      expect(response.body.items[1]._expansionErrors['UserDTO.failingExpander']).toBeDefined()

      // No errors should be attached to the root response object
      expect(response.body._expansionErrors).toBeUndefined()
    })

    it('should attach errors to single object within rootField', async () => {
      const response = await request(app.getHttpServer()).get('/users/paginated-single?expands=profile')

      expect(response.status).toBe(200)
      expect(response.body.item).toBeDefined()

      // The single user should have profile error
      expect(response.body.item.profile).toBeUndefined()
      expect(response.body.item._expansionErrors).toBeDefined()
      expect(response.body.item._expansionErrors['UserDTO.profile']).toBeDefined()
      expect(response.body.item._expansionErrors['UserDTO.profile'].message).toContain(
        'Custom error format: Profile not found'
      )

      // No errors should be attached to the root response object
      expect(response.body._expansionErrors).toBeUndefined()
    })
  })
})
