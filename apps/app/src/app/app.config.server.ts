import { ApplicationConfig, mergeApplicationConfig, provideZoneChangeDetection } from '@angular/core'
import { provideServerRendering, withRoutes } from '@angular/ssr'
import { provideNgeDocSsr } from '@cisstech/nge/doc/ssr'

import { appConfig } from './app.config'
import { serverRoutes } from './app.routes.server'

const serverConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    provideServerRendering(withRoutes(serverRoutes)),
    provideNgeDocSsr({ roots: ['apps/app/public'] }),
  ],
}

export const config = mergeApplicationConfig(appConfig, serverConfig)
