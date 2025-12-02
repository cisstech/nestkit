import { EntityMetadata } from 'typeorm'

/**
 * Helper method to convert a string to a number for advisory locks
 * @param str The string to convert to a number
 * @returns The number representation of the string
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
 * Create and return an entity based on the table name and data received from PostgreSQL.
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
