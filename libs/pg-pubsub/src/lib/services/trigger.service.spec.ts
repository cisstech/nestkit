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
      // Mock: meta table exists, no stored hashes, two existing triggers in DB
      const ensureMetaSpy = jest.spyOn(triggerService as any, 'ensureMetaTable').mockResolvedValue(undefined)
      jest.spyOn(triggerService as any, 'loadStoredHashes').mockResolvedValue(new Map())
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue([
        { name: 'test_prefix_posts', schema: 'public', table: 'posts' },
        { name: 'test_prefix_users', schema: 'public', table: 'users' },
      ])
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

      expect(ensureMetaSpy).toHaveBeenCalled()
      expect(createTriggersSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ table: 'users', schema: 'public' }),
          expect.objectContaining({ table: 'comments', schema: 'public' }),
        ]),
        mockDiscovery.propNameToColumnNames
      )
      expect(dropTriggersSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ table: 'posts' })])
      )
      expect(createTriggersSpy.mock.invocationCallOrder[0]).toBeLessThan(dropTriggersSpy.mock.invocationCallOrder[0])
    })

    it('should skip triggers when stored hash matches (no DDL needed)', async () => {
      const propNameToColumnNames = {
        users: new Map([['name', 'name']]),
      }

      const expectedHash = triggerService.computeTriggerHash(
        { table: 'users', schema: 'public', name: 'test_prefix_users', events: ['INSERT'] },
        propNameToColumnNames
      )

      jest.spyOn(triggerService as any, 'ensureMetaTable').mockResolvedValue(undefined)
      jest
        .spyOn(triggerService as any, 'loadStoredHashes')
        .mockResolvedValue(new Map([['test_prefix_users', expectedHash]]))
      jest
        .spyOn(triggerService as any, 'listTriggers')
        .mockResolvedValue([{ name: 'test_prefix_users', schema: 'public', table: 'users' }])
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)
      const dropTriggersSpy = jest.spyOn(triggerService as any, 'dropTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [{ table: 'users', schema: 'public', events: ['INSERT'] }],
        propNameToColumnNames,
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).not.toHaveBeenCalled()
      expect(dropTriggersSpy).not.toHaveBeenCalled()
    })

    it('should recreate trigger when stored hash differs', async () => {
      const propNameToColumnNames = {
        users: new Map([['name', 'name']]),
      }

      jest.spyOn(triggerService as any, 'ensureMetaTable').mockResolvedValue(undefined)
      jest
        .spyOn(triggerService as any, 'loadStoredHashes')
        .mockResolvedValue(new Map([['test_prefix_users', 'stale_hash']]))
      jest
        .spyOn(triggerService as any, 'listTriggers')
        .mockResolvedValue([{ name: 'test_prefix_users', schema: 'public', table: 'users' }])
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [{ table: 'users', schema: 'public', events: ['INSERT', 'UPDATE'] }],
        propNameToColumnNames,
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ table: 'users' })]),
        propNameToColumnNames
      )
    })

    it('should recreate trigger when no stored hash exists (fresh or migration)', async () => {
      jest.spyOn(triggerService as any, 'ensureMetaTable').mockResolvedValue(undefined)
      jest.spyOn(triggerService as any, 'loadStoredHashes').mockResolvedValue(new Map())
      jest
        .spyOn(triggerService as any, 'listTriggers')
        .mockResolvedValue([{ name: 'test_prefix_users', schema: 'public', table: 'users' }])
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [{ table: 'users', schema: 'public', events: ['INSERT'] }],
        propNameToColumnNames: { users: new Map([['name', 'name']]) },
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).toHaveBeenCalled()
    })

    it('should handle empty existing triggers (fresh setup)', async () => {
      jest.spyOn(triggerService as any, 'ensureMetaTable').mockResolvedValue(undefined)
      jest.spyOn(triggerService as any, 'loadStoredHashes').mockResolvedValue(new Map())
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue([])
      const dropTriggersSpy = jest.spyOn(triggerService as any, 'dropTriggers').mockResolvedValue(undefined)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      const mockDiscovery = {
        listeners: [{ table: 'users', schema: 'public', events: ['INSERT'] }],
        propNameToColumnNames: { users: new Map([['name', 'name']]) },
      }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).toHaveBeenCalled()
      expect(dropTriggersSpy).not.toHaveBeenCalled()
    })

    it('should drop all triggers when no listeners provided', async () => {
      const existingTriggers = [
        { name: 'test_prefix_users', schema: 'public', table: 'users' },
        { name: 'test_prefix_posts', schema: 'public', table: 'posts' },
      ]
      jest.spyOn(triggerService as any, 'ensureMetaTable').mockResolvedValue(undefined)
      jest.spyOn(triggerService as any, 'loadStoredHashes').mockResolvedValue(new Map())
      jest.spyOn(triggerService as any, 'listTriggers').mockResolvedValue(existingTriggers)
      const dropTriggersSpy = jest.spyOn(triggerService as any, 'dropTriggers').mockResolvedValue(undefined)
      const createTriggersSpy = jest.spyOn(triggerService as any, 'createTriggers').mockResolvedValue(undefined)

      const mockDiscovery = { listeners: [], propNameToColumnNames: {} }

      await triggerService.setupTriggers(mockDiscovery as any)

      expect(createTriggersSpy).not.toHaveBeenCalled()
      expect(dropTriggersSpy).toHaveBeenCalledWith(existingTriggers)
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
    it('should list existing triggers from information_schema', async () => {
      const mockTriggers = [{ name: 'test_prefix_users', schema: 'public', table: 'users' }]
      pgPool.query.mockResolvedValueOnce(mockTriggers)

      const result = await (triggerService as any).listTriggers()

      expect(pgPool.query).toHaveBeenCalledWith(expect.stringContaining('information_schema.triggers'), [
        `${config.triggerPrefix}_%`,
      ])
      expect(result).toEqual([{ name: 'test_prefix_users', schema: 'public', table: 'users' }])
    })
  })

  describe('dropTriggers', () => {
    it('should drop specified triggers and clean up metadata', async () => {
      const triggers = [{ name: 'test_prefix_users', schema: 'public', table: 'users' }]

      await (triggerService as any).dropTriggers(triggers)

      expect(pgPool.query).toHaveBeenCalledWith(
        expect.stringContaining(`DROP FUNCTION IF EXISTS public."test_prefix_users" CASCADE`)
      )
      // Should also clean up the metadata table
      expect(pgPool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM'), [['test_prefix_users']])
    })

    it('should do nothing if triggers list is empty', async () => {
      await (triggerService as any).dropTriggers([])

      expect(pgPool.query).not.toHaveBeenCalled()
    })
  })

  describe('createTriggers', () => {
    it('should create trigger function and attach trigger if table exists', async () => {
      const triggers = [{ name: 'test_prefix_users', schema: 'public', table: 'users', events: ['INSERT'] }]
      const propNameToColumnNames = {
        users: new Map([
          ['name', 'name'],
          ['email', 'email'],
        ]),
      }

      // Mock: function creation, table exists check, trigger creation, hash upsert
      pgPool.query
        .mockResolvedValueOnce(undefined) // CREATE OR REPLACE FUNCTION
        .mockResolvedValueOnce([{ exists: true }]) // table exists check
        .mockResolvedValueOnce(undefined) // CREATE TRIGGER
        .mockResolvedValueOnce(undefined) // INSERT INTO meta table

      await (triggerService as any).createTriggers(triggers, propNameToColumnNames)

      expect(pgPool.query).toHaveBeenCalledWith(
        expect.stringContaining(`CREATE OR REPLACE FUNCTION public."test_prefix_users"()`)
      )
      expect(pgPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (trigger_name) DO UPDATE'),
        expect.arrayContaining(['test_prefix_users'])
      )
    })

    it('should skip trigger attachment if table does not exist', async () => {
      const triggers = [{ name: 'test_prefix_users', schema: 'public', table: 'users', events: ['INSERT'] }]
      const propNameToColumnNames = { users: new Map([['name', 'name']]) }

      pgPool.query
        .mockResolvedValueOnce(undefined) // CREATE OR REPLACE FUNCTION
        .mockResolvedValueOnce([{ exists: false }]) // table does NOT exist

      await (triggerService as any).createTriggers(triggers, propNameToColumnNames)

      // Should NOT have tried to CREATE TRIGGER or upsert hash
      const calls = pgPool.query.mock.calls
      const hasCreateTrigger = calls.some((c: any[]) => typeof c[0] === 'string' && c[0].includes('CREATE TRIGGER'))
      expect(hasCreateTrigger).toBe(false)
    })

    it('should do nothing if triggers list is empty', async () => {
      await (triggerService as any).createTriggers([], {})

      expect(pgPool.query).not.toHaveBeenCalled()
    })
  })
})
