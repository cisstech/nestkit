/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test } from '@nestjs/testing'
import { PG_PUBSUB_CONFIG } from '../pg-pubsub'
import { PgConnectionPoolService } from './pg-connection-pool.service'
import { PgTriggerService } from './trigger.service'

describe('PgTriggerService', () => {
  let triggerService: PgTriggerService
  let pgPool: {
    query: jest.Mock
  }
  const config = {
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    triggerPrefix: 'test_prefix',
    triggerSchema: 'public',
    queue: {
      schema: 'public',
      table: 'test_queue',
    },
  }

  beforeEach(async () => {
    pgPool = {
      query: jest.fn().mockResolvedValue([]),
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        PgTriggerService,
        {
          provide: PgConnectionPoolService,
          useValue: pgPool,
        },
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: config,
        },
      ],
    }).compile()

    triggerService = moduleRef.get<PgTriggerService>(PgTriggerService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('setupTriggers', () => {
    it('should use differential update: upsert desired triggers then drop obsolete ones', async () => {
      // Mock existing triggers (no matching hash → will be recreated)
      const existingTriggers = [
        { name: 'test_prefix_posts', schema: 'public', table: 'posts', hash: undefined },
        { name: 'test_prefix_users', schema: 'public', table: 'users', hash: undefined },
      ]
      const listTriggersSpy = jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue(existingTriggers)
      const dropTriggersSpy = jest.spyOn(triggerService as any, 'dropTriggers').mockResolvedValue(undefined)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      // New discovery wants users and comments (posts is obsolete)
      const mockDiscovery = {
        listeners: [
          { table: 'users', schema: 'public', events: ['INSERT'] },
          { table: 'comments', schema: 'public', events: ['INSERT', 'UPDATE'] },
        ],
        propNameToColumnNames: {
          users: new Map([['name', 'name']]),
          comments: new Map([['text', 'text']]),
        },
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(listTriggersSpy).toHaveBeenCalled()

      // Verify createTriggers was called with ALL desired triggers (since no hash matches)
      expect(createTriggersSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ table: 'users', schema: 'public' }),
          expect.objectContaining({ table: 'comments', schema: 'public' }),
        ]),
        mockDiscovery.propNameToColumnNames
      )

      // Verify dropTriggers was called with ONLY obsolete trigger (posts)
      expect(dropTriggersSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ table: 'posts' })])
      )

      // Verify order: create before drop
      expect(createTriggersSpy.mock.invocationCallOrder[0]).toBeLessThan(dropTriggersSpy.mock.invocationCallOrder[0])
    })

    it('should skip triggers with matching hash (no DDL needed)', async () => {
      const propNameToColumnNames = {
        users: new Map([['name', 'name']]),
      }

      // Compute the expected hash for the trigger config
      const expectedHash = triggerService.computeTriggerHash(
        {
          table: 'users',
          schema: 'public',
          name: 'test_prefix_users',
          events: ['INSERT'],
        },
        propNameToColumnNames
      )

      // Mock existing triggers WITH matching hash
      const existingTriggers = [{ name: 'test_prefix_users', schema: 'public', table: 'users', hash: expectedHash }]
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue(existingTriggers)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)
      const dropTriggersSpy = jest.spyOn(triggerService as any, 'dropTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [{ table: 'users', schema: 'public', events: ['INSERT'] }],
        propNameToColumnNames,
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      // No triggers should be created or dropped
      expect(createTriggersSpy).not.toHaveBeenCalled()
      expect(dropTriggersSpy).not.toHaveBeenCalled()
    })

    it('should recreate trigger when hash differs (config changed)', async () => {
      const propNameToColumnNames = {
        users: new Map([['name', 'name']]),
      }

      // Mock existing triggers with a stale hash
      const existingTriggers = [
        { name: 'test_prefix_users', schema: 'public', table: 'users', hash: 'stale_hash_value' },
      ]
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue(existingTriggers)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [{ table: 'users', schema: 'public', events: ['INSERT', 'UPDATE'] }],
        propNameToColumnNames,
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      // Trigger should be recreated since hash doesn't match
      expect(createTriggersSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ table: 'users' })]),
        propNameToColumnNames
      )
    })

    it('should recreate trigger when no hash exists (migration from old version)', async () => {
      // Mock existing triggers WITHOUT hash (legacy)
      const existingTriggers = [{ name: 'test_prefix_users', schema: 'public', table: 'users', hash: undefined }]
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue(existingTriggers)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [{ table: 'users', schema: 'public', events: ['INSERT'] }],
        propNameToColumnNames: {
          users: new Map([['name', 'name']]),
        },
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).toHaveBeenCalled()
    })

    it('should only upsert when no obsolete triggers exist', async () => {
      const existingTriggers = [{ name: 'test_prefix_users', schema: 'public', table: 'users', hash: undefined }]
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue(existingTriggers)
      const dropTriggersSpy = jest.spyOn(triggerService as any, 'dropTriggers').mockResolvedValue(undefined)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [
          { table: 'users', schema: 'public', events: ['INSERT'] },
          { table: 'posts', schema: 'public', events: ['INSERT'] },
        ],
        propNameToColumnNames: {
          users: new Map([['name', 'name']]),
          posts: new Map([['title', 'title']]),
        },
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).toHaveBeenCalled()
      expect(dropTriggersSpy).not.toHaveBeenCalled()
    })

    it('should handle empty existing triggers (fresh setup)', async () => {
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue([])
      const dropTriggersSpy = jest.spyOn(triggerService as any, 'dropTriggers').mockResolvedValue(undefined)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [{ table: 'users', schema: 'public', events: ['INSERT'] }],
        propNameToColumnNames: {
          users: new Map([['name', 'name']]),
        },
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).toHaveBeenCalled()
      expect(dropTriggersSpy).not.toHaveBeenCalled()
    })

    it('should drop all triggers when no listeners provided', async () => {
      const existingTriggers = [
        { name: 'test_prefix_users', schema: 'public', table: 'users', hash: undefined },
        { name: 'test_prefix_posts', schema: 'public', table: 'posts', hash: undefined },
      ]
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue(existingTriggers)
      const dropTriggersSpy = jest.spyOn(triggerService as any, 'dropTriggers').mockResolvedValue(undefined)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [],
        propNameToColumnNames: {},
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).not.toHaveBeenCalled()
      expect(dropTriggersSpy).toHaveBeenCalledWith(existingTriggers)
    })

    it('should handle schema differences correctly', async () => {
      const existingTriggers = [
        { name: 'test_prefix_users', schema: 'public', table: 'users', hash: undefined },
        { name: 'test_prefix_users', schema: 'private', table: 'users', hash: undefined },
      ]
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue(existingTriggers)
      const dropTriggersSpy = jest.spyOn(triggerService as any, 'dropTriggers').mockResolvedValue(undefined)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      // Only want public.users
      const mockDiscovery = {
        listeners: [{ table: 'users', schema: 'public', events: ['INSERT'] }],
        propNameToColumnNames: {
          users: new Map([['name', 'name']]),
        },
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).toHaveBeenCalled()
      // Should drop private.users but not public.users
      expect(dropTriggersSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ schema: 'private', table: 'users' })])
      )
    })
  })

  describe('computeTriggerHash', () => {
    it('should produce deterministic hash', () => {
      const trigger = { name: 'test_prefix_users', table: 'users', schema: 'public', events: ['INSERT' as const] }
      const propNameToColumnNames = { users: new Map([['name', 'name']]) }

      const hash1 = triggerService.computeTriggerHash(trigger, propNameToColumnNames)
      const hash2 = triggerService.computeTriggerHash(trigger, propNameToColumnNames)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(32) // MD5 hex length
    })

    it('should produce different hash for different events', () => {
      const propNameToColumnNames = { users: new Map([['name', 'name']]) }

      const hash1 = triggerService.computeTriggerHash(
        { name: 'test_prefix_users', table: 'users', schema: 'public', events: ['INSERT'] },
        propNameToColumnNames
      )
      const hash2 = triggerService.computeTriggerHash(
        { name: 'test_prefix_users', table: 'users', schema: 'public', events: ['INSERT', 'UPDATE'] },
        propNameToColumnNames
      )

      expect(hash1).not.toBe(hash2)
    })

    it('should produce same hash regardless of event order', () => {
      const propNameToColumnNames = { users: new Map([['name', 'name']]) }

      const hash1 = triggerService.computeTriggerHash(
        { name: 'test_prefix_users', table: 'users', schema: 'public', events: ['UPDATE', 'INSERT'] },
        propNameToColumnNames
      )
      const hash2 = triggerService.computeTriggerHash(
        { name: 'test_prefix_users', table: 'users', schema: 'public', events: ['INSERT', 'UPDATE'] },
        propNameToColumnNames
      )

      expect(hash1).toBe(hash2)
    })
  })

  describe('listTriggers', () => {
    it('should list existing triggers with hash from comment', async () => {
      const mockTriggers = [
        { name: 'test_prefix_users', schema: 'public', table: 'users', comment: 'pg-pubsub:hash=abc123' },
      ]
      pgPool.query.mockResolvedValueOnce(mockTriggers)

      const result = await (triggerService as any).listTriggers()

      expect(pgPool.query).toHaveBeenCalledWith(expect.stringContaining(`DISTINCT ON`))
      expect(result).toEqual([{ name: 'test_prefix_users', schema: 'public', table: 'users', hash: 'abc123' }])
    })

    it('should return undefined hash when comment has wrong format', async () => {
      const mockTriggers = [
        { name: 'test_prefix_users', schema: 'public', table: 'users', comment: 'some random comment' },
      ]
      pgPool.query.mockResolvedValueOnce(mockTriggers)

      const result = await (triggerService as any).listTriggers()

      expect(result[0].hash).toBeUndefined()
    })
  })

  describe('dropTriggers', () => {
    it('should drop specified triggers', async () => {
      const triggers = [{ name: 'test_prefix_users', schema: 'public', table: 'users' }]

      await (triggerService as any).dropTriggers(triggers)

      expect(pgPool.query).toHaveBeenCalledWith(
        expect.stringContaining(`DROP FUNCTION IF EXISTS public."test_prefix_users" CASCADE`)
      )
    })

    it('should do nothing if triggers list is empty', async () => {
      await (triggerService as any).dropTriggers([])

      expect(pgPool.query).not.toHaveBeenCalled()
    })
  })

  describe('createTriggers', () => {
    it('should create triggers for the provided metadata', async () => {
      const triggers = [
        {
          name: 'test_prefix_users',
          schema: 'public',
          table: 'users',
          events: ['INSERT'],
        },
      ]

      const propNameToColumnNames = {
        users: new Map([
          ['name', 'name'],
          ['email', 'email'],
        ]),
      }

      await (triggerService as any).createTriggers(triggers, propNameToColumnNames)

      expect(pgPool.query).toHaveBeenCalledWith(
        // eslint-disable-next-line no-useless-escape
        expect.stringContaining(`CREATE OR REPLACE FUNCTION public.\"test_prefix_users\"()`)
      )
      // Verify COMMENT ON FUNCTION is included
      expect(pgPool.query).toHaveBeenCalledWith(expect.stringContaining(`COMMENT ON FUNCTION`))
    })

    it('should do nothing if triggers list is empty', async () => {
      await (triggerService as any).createTriggers([], {})

      expect(pgPool.query).not.toHaveBeenCalled()
    })
  })
})
