import { Logger, Module } from '@nestjs/common'

import { AppController } from './app.controller'
import { ExpandSampleModule } from './samples/expand'

@Module({
  imports: [ExpandSampleModule],
  controllers: [AppController],
  providers: [Logger],
})
export class AppModule {}
