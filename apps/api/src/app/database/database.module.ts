import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { config } from './database.config'

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...config,
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
