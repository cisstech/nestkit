// expand.module

import { DynamicModule, Global, Module } from '@nestjs/common'

import { APP_INTERCEPTOR } from '@nestjs/core'
import { EXPAND_CONFIG, ExpandConfig } from './expand'
import { ExpandInterceptor } from './expand.interceptor'
import { ExpandService } from './expand.service'

@Global()
@Module({
  imports: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ExpandInterceptor,
    },
    ExpandService,
  ],
  exports: [ExpandService],
})
export class NestKitExpandModule {
  static forRoot(config?: ExpandConfig): DynamicModule {
    return {
      module: NestKitExpandModule,
      providers: [
        {
          provide: EXPAND_CONFIG,
          useValue: config,
        },
      ],
      exports: [ExpandService],
    }
  }
}
