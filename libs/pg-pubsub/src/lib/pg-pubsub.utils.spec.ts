import { EntityMetadata } from 'typeorm'
import { createEntity, hashStringToInt } from './pg-pubsub.utils'

describe('hashStringToInt', () => {
  it('should return a number', () => {
    const result = hashStringToInt('test')
    expect(typeof result).toBe('number')
  })

  it('should return the same number for the same input string', () => {
    const input = 'test-string'
    const result1 = hashStringToInt(input)
    const result2 = hashStringToInt(input)
    expect(result1).toBe(result2)
  })

  it('should return different numbers for different input strings', () => {
    const result1 = hashStringToInt('test1')
    const result2 = hashStringToInt('test2')
    expect(result1).not.toBe(result2)
  })

  it('should return a non-negative number', () => {
    const result = hashStringToInt('test')
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('should return a number within PostgreSQL integer range', () => {
    const result = hashStringToInt('test')
    expect(result).toBeLessThanOrEqual(2147483647)
  })

  it('should handle empty strings', () => {
    const result = hashStringToInt('')
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('should handle long strings', () => {
    const longString = 'a'.repeat(10000)
    const result = hashStringToInt(longString)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(2147483647)
  })
})

describe('createEntity', () => {
  it('should throw an error if table metadata is not found', () => {
    expect(() => {
      createEntity('non_existent_table', {}, {}, {})
    }).toThrow('Table non_existent_table not found in metadata')
  })

  it('should throw an error if column mapping is not found for the table', () => {
    const tablesMap: Record<string, EntityMetadata> = {
      users: { create: () => ({}) } as unknown as EntityMetadata,
    }
    expect(() => {
      createEntity('users', {}, tablesMap, {})
    }).toThrow('Column mapping for table users not found')
  })

  it('should create an entity with mapped properties', () => {
    // Mock data
    const tableName = 'users'
    const data = {
      user_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
    }

    // Mock column mapping
    const columnsMap = new Map<string, string>()
    columnsMap.set('user_id', 'id')
    columnsMap.set('first_name', 'firstName')
    columnsMap.set('last_name', 'lastName')
    columnsMap.set('email', 'email')

    // Mock entity metadata
    const mockEntity = {}
    const mockCreate = jest.fn().mockReturnValue(mockEntity)
    const tablesMap = {
      [tableName]: {
        create: mockCreate,
      } as unknown as EntityMetadata,
    }

    const columnNameToPropNames = {
      [tableName]: columnsMap,
    }

    // Call the function
    const result = createEntity(tableName, data, tablesMap, columnNameToPropNames)

    // Assertions
    expect(mockCreate).toHaveBeenCalled()
    expect(result).toBe(mockEntity)
    expect(result).toEqual({
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    })
  })

  it('should ignore properties not in the column mapping', () => {
    const tableName = 'users'
    const data = {
      user_id: 1,
      first_name: 'John',
      unknown_field: 'Should be ignored',
    }

    const columnsMap = new Map<string, string>()
    columnsMap.set('user_id', 'id')
    columnsMap.set('first_name', 'firstName')

    const mockEntity = {}
    const mockCreate = jest.fn().mockReturnValue(mockEntity)
    const tablesMap = {
      [tableName]: {
        create: mockCreate,
      } as unknown as EntityMetadata,
    }

    const columnNameToPropNames = {
      [tableName]: columnsMap,
    }

    const result = createEntity(tableName, data, tablesMap, columnNameToPropNames)

    expect(result).toEqual({
      id: 1,
      firstName: 'John',
    })
    expect(result).not.toHaveProperty('unknown_field')
  })

  it('should handle empty data object', () => {
    const tableName = 'users'
    const data = {}

    const columnsMap = new Map<string, string>()
    columnsMap.set('user_id', 'id')

    const mockEntity = {}
    const mockCreate = jest.fn().mockReturnValue(mockEntity)
    const tablesMap = {
      [tableName]: {
        create: mockCreate,
      } as unknown as EntityMetadata,
    }

    const columnNameToPropNames = {
      [tableName]: columnsMap,
    }

    const result = createEntity(tableName, data, tablesMap, columnNameToPropNames)

    expect(mockCreate).toHaveBeenCalled()
    expect(result).toEqual({})
  })

  it('should handle null values in data', () => {
    const tableName = 'users'
    const data = {
      user_id: 1,
      first_name: null,
    }

    const columnsMap = new Map<string, string>()
    columnsMap.set('user_id', 'id')
    columnsMap.set('first_name', 'firstName')

    const mockEntity = {}
    const mockCreate = jest.fn().mockReturnValue(mockEntity)
    const tablesMap = {
      [tableName]: {
        create: mockCreate,
      } as unknown as EntityMetadata,
    }

    const columnNameToPropNames = {
      [tableName]: columnsMap,
    }

    const result = createEntity(tableName, data, tablesMap, columnNameToPropNames)

    expect(result).toEqual({
      id: 1,
      firstName: null,
    })
  })
})
