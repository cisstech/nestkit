import { Route } from '@angular/router'
import { NestJsExpandDoc } from './docs/nestjs-expand'
import { NestJsPgPubSubDoc } from './docs/nestjs-pg-pubsub'

export const appRoutes: Route[] = [
  { path: '', loadChildren: () => import('./home/home.routes') },
  {
    path: 'docs',
    loadChildren: () => import('@cisstech/nge/doc').then((m) => m.NgeDocModule),
    data: [NestJsExpandDoc, NestJsPgPubSubDoc],
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
]
