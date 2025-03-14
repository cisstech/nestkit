import 'dotenv/config'

import { DataSourceOptions } from 'typeorm'

export const config: DataSourceOptions = {
  type: 'postgres',
  host: process.env['POSTGRES_HOST'],
  port: parseInt(process.env['POSTGRES_PORT'] || '5432'),
  username: process.env['POSTGRES_USER'],
  password: process.env['POSTGRES_PASSWORD'],
  database: process.env['POSTGRES_DB'],
  url: process.env['DATABASE_URL'],
  synchronize: false,
  migrationsRun: false,
  logging: ['error'],
  logger: 'advanced-console',
}
