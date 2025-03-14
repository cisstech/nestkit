import { DataSource, DataSourceOptions } from 'typeorm'
import { config } from './database.config'

export const AppDataSource = new DataSource({
  ...config,
  entities: ['apps/**/*.entity.ts'],
  migrations: ['migrations/*.ts'],
} as DataSourceOptions)
