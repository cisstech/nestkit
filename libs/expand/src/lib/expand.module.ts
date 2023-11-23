// expand.module

import { Global, Module } from '@nestjs/common'

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
export class ExpandModule {
  static forRoot(config?: ExpandConfig): ExpandModule {
    return {
      module: ExpandModule,
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
