import 'dotenv/config'
import { Client } from 'pg'

export async function createTestDatabase(): Promise<string> {
  const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_DB } = process.env
  // Connect to default postgres database
  const client = new Client({
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    host: POSTGRES_HOST,
    port: 5432,
    database: POSTGRES_DB,
  })

  try {
    await client.connect()
    await client.query('DROP DATABASE IF EXISTS nestkit_test')
    await client.query('CREATE DATABASE nestkit_test')
  } catch (err) {
    console.error('Error creating test database:', err)
  } finally {
    await client.end()
  }

  return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/nestkit_test`
}
