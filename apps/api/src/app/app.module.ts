import { Module } from '@nestjs/common'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { NestKitExpandModule } from '@cisstech/nestjs-expand'

@Module({
  imports: [NestKitExpandModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
