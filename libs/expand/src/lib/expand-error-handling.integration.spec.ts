/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, HttpException, HttpStatus, INestApplication, Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { ExpandContext, Expandable, Expander, Selectable } from './expand'
import { NestKitExpandModule } from './expand.module'

// DTOs
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

// Mock data
const mockUsers: UserDTO[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', profileId: 1 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', profileId: undefined },
]

const mockProfiles: ProfileDTO[] = [{ id: 1, bio: 'Software developer', avatar: 'avatar1.jpg' }]

// Service implementations
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

// Error throwing expander
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

// Controllers
@Controller('users')
class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Expandable(UserDTO)
  @Selectable()
  findAll() {
    return this.userService.findAll()
  }

  @Get('error')
  @Expandable(UserDTO)
  findWithError() {
    throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR)
  }

  @Get('error-response')
  findWithErrorResponse() {
    return {
      error: true,
      message: 'This is an error response',
      status: 400,
    }
  }
}

// Test Module with error logging disabled
@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: false,
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

  describe('Error Handling', () => {
    it('should handle errors in expanders gracefully', async () => {
      const response = await request(app.getHttpServer()).get('/users?expands=profile')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(mockUsers.length)

      // All expensions should fail if any of them throw an error
      expect(response.body[0].profile).toBeUndefined()
      expect(response.body[1].profile).toBeUndefined()
    })

    it('should handle failing expanders gracefully', async () => {
      const response = await request(app.getHttpServer()).get('/users?expands=failingExpander')

      expect(response.status).toBe(200)
      // The expansion should fail but the base response should still work
      expect(response.body).toEqual(mockUsers)
    })

    it('should not attempt expansion when controller returns error status code', async () => {
      const response = await request(app.getHttpServer()).get('/users/error?expands=profile')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Internal server error')
    })

    it('should handle non-existent expanders', async () => {
      const response = await request(app.getHttpServer()).get('/users?expands=nonExistentExpander')

      expect(response.status).toBe(200)
      // The response should be returned without the non-existent expansion
      expect(response.body).toEqual(mockUsers)
    })
  })
})
