import { ApplicationConfig, importProvidersFrom } from '@angular/core'
import { provideAnimations } from '@angular/platform-browser/animations'
import { PreloadAllModules, provideRouter, withEnabledBlockingInitialNavigation, withPreloading } from '@angular/router'
import { appRoutes } from './app.routes'

import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { NGE_DOC_RENDERERS } from '@cisstech/nge/doc'
import {
  NgeMarkdownAdmonitionsProvider,
  NgeMarkdownEmojiProvider,
  NgeMarkdownHighlighterMonacoProvider,
  NgeMarkdownHighlighterProvider,
  NgeMarkdownIconsProvider,
  NgeMarkdownKatexProvider,
  NgeMarkdownLinkAnchorProvider,
  NgeMarkdownModule,
  NgeMarkdownTabbedSetProvider,
  NgeMarkdownThemeProvider,
} from '@cisstech/nge/markdown'
import { NGE_MONACO_THEMES, NgeMonacoColorizerService, NgeMonacoModule } from '@cisstech/nge/monaco'

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
    importProvidersFrom(
      NgeMarkdownModule,
      NgeMonacoModule.forRoot({
        locale: 'fr',
        theming: {
          themes: NGE_MONACO_THEMES.map((theme) => 'assets/vendors/nge/monaco/themes/' + theme),
          default: 'github',
        },
      })
    ),
    NgeMarkdownKatexProvider,
    NgeMarkdownIconsProvider,
    NgeMarkdownEmojiProvider,
    NgeMarkdownTabbedSetProvider,
    NgeMarkdownLinkAnchorProvider,
    NgeMarkdownAdmonitionsProvider,
    NgeMarkdownHighlighterProvider,
    NgeMarkdownThemeProvider({
      name: 'github',
      styleUrl: 'assets/vendors/nge/markdown/themes/github.css',
    }),
    NgeMarkdownHighlighterMonacoProvider(NgeMonacoColorizerService),
    {
      provide: NGE_DOC_RENDERERS,
      useValue: {
        markdown: {
          component: () => import('@cisstech/nge/markdown').then((m) => m.NgeMarkdownComponent),
        },
      },
    },
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation(), withPreloading(PreloadAllModules)),
  ],
}
