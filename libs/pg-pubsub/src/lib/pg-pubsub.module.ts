import { DynamicModule, Global, Module } from '@nestjs/common'
import { DiscoveryModule } from '@golevelup/nestjs-discovery'
import { PG_PUBSUB_CONFIG, PG_PUBSUB_LOCK_SERVICE, PgPubSubConfig } from './pg-pubsub'
import { PgPubSubService } from './pg-pubsub.service'
import { InMemoryLockService } from './lock'

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [PgPubSubService],
  exports: [PgPubSubService],
})
export class PgPubSubModule {
  static forRoot(config: PgPubSubConfig): DynamicModule {
    return {
      module: PgPubSubModule,
      providers: [
        {
          provide: PG_PUBSUB_CONFIG,
          useValue: config,
        },
        {
          provide: PG_PUBSUB_LOCK_SERVICE,
          useFactory: () => {
            return config.lockService || new InMemoryLockService()
          },
        },
      ],
      exports: [PgPubSubService],
    }
  }
}
