import { Route } from '@angular/router'
import { docsFromManifest } from '@cisstech/nge/doc'

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'docs/overview/introduction', pathMatch: 'full' },
  {
    path: 'docs',
    loadChildren: () => import('@cisstech/nge/doc').then((m) => m.NGE_DOC_ROUTES),
    data: docsFromManifest('docs/nge-doc.json'),
  },
  { path: '**', redirectTo: 'docs/overview/introduction' },
]
