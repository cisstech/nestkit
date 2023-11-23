import { Route } from '@angular/router'
import { NestJsExpandDoc } from './docs/nestjs-expand'

export const appRoutes: Route[] = [
  { path: '', loadChildren: () => import('./home/home.routes') },
  {
    path: 'docs',
    loadChildren: () => import('@cisstech/nge/doc').then((m) => m.NgeDocModule),
    data: [NestJsExpandDoc],
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
]
