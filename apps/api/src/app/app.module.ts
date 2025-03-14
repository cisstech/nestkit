import { Logger, Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { DatabaseModule } from './database/database.module'
import { ExpandSampleModule } from './samples/expand'
import { PubSubSampleModule } from './samples/pubsub'

@Module({
  imports: [DatabaseModule, ExpandSampleModule, PubSubSampleModule],
  controllers: [AppController],
  providers: [Logger],
})
export class AppModule {}
