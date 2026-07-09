import { Route } from '@angular/router'
import { NestJsExpandDoc } from './docs/nestjs-expand'
import { NestJsPgPubSubDoc } from './docs/nestjs-pg-pubsub'
import { NestKitOverview } from './docs/overview'

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'docs/overview', pathMatch: 'full' },
  {
    path: 'docs',
    loadChildren: () => import('@cisstech/nge/doc').then((m) => m.NgeDocModule),
    data: [NestKitOverview, NestJsExpandDoc, NestJsPgPubSubDoc],
  },
  { path: '**', redirectTo: 'docs/overview' },
]
