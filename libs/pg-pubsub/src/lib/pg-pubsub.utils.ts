import { EntityMetadata } from 'typeorm'

/**
 * Validates that a string is a safe SQL identifier (alphanumeric + underscores only).
 */
export const assertSafeIdentifier = (value: string, label: string): void => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ${label}: "${value}". Only alphanumeric characters and underscores are allowed.`)
  }
}

/**
 * Convert a string to a 32-bit integer for advisory locks.
 */
export const hashStringToInt = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483647 // Ensure positive value within PostgreSQL integer range
}

/**
 * Create an entity instance from raw PostgreSQL row data.
 */
export const createEntity = (
  tableName: string,
  data: unknown,
  tablesMap: Record<string, EntityMetadata>,
  columnNameToPropNames: Record<string, Map<string, string>>
): Record<string, unknown> => {
  const table = tablesMap[tableName]
  if (!table) {
    throw new Error(`Table ${tableName} not found in metadata`)
  }

  if (!columnNameToPropNames[tableName]) {
    throw new Error(`Column mapping for table ${tableName} not found`)
  }

  const columns = columnNameToPropNames[tableName]
  const entity = table.create()

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const propertyName = columns.get(key)
    if (propertyName) {
      entity[propertyName] = value
    }
  }

  return entity
}
