import { ApplicationConfig, importProvidersFrom } from '@angular/core'
import { provideAnimations } from '@angular/platform-browser/animations'
import { PreloadAllModules, provideRouter, withEnabledBlockingInitialNavigation, withPreloading } from '@angular/router'
import { appRoutes } from './app.routes'

import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http'
import { provideNgeDoc, withBrand, withMarkdownRenderer, withNavbar } from '@cisstech/nge/doc'
import {
  NgeMarkdownAdmonitionsProvider,
  NgeMarkdownConfig,
  NgeMarkdownConfigProvider,
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

export function markdownOptions(): NgeMarkdownConfig {
  return {
    // Align nge-markdown's dark detection with the class the doc theme toggles.
    darkThemeClassName: 'nge-doc-dark',
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
    importProvidersFrom(
      NgeMarkdownModule,
      NgeMonacoModule.forRoot({
        locale: 'fr',
        theming: {
          themes: NGE_MONACO_THEMES.map((theme) => 'assets/vendors/nge/monaco/themes/' + theme),
          default: 'github',
          // Follow the documentation color scheme: nge-doc toggles `nge-doc-dark`
          // on <html>, and Monaco switches themes accordingly.
          light: 'github',
          dark: 'tomorrow-night',
          darkThemeClassName: 'nge-doc-dark',
        },
      })
    ),
    NgeMarkdownConfigProvider(markdownOptions),
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
    provideNgeDoc(
      withBrand({ title: 'NestKit', icon: 'assets/icons/nestjs.svg', href: '/' }),
      withNavbar([
        { title: '@nestjs-expand', href: '/docs/nestjs-expand/', icon: 'assets/icons/nestjs.svg' },
        { title: '@nestjs-pg-pubsub', href: '/docs/nestjs-pg-pubsub/', icon: 'assets/icons/nestjs.svg' },
        {
          title: 'GitHub',
          href: 'https://github.com/cisstech/nestkit',
          icon: 'https://icongr.am/octicons/mark-github.svg',
          external: true,
        },
      ]),
      withMarkdownRenderer({
        component: () => import('@cisstech/nge/markdown').then((m) => m.NgeMarkdownComponent),
      })
    ),
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation(), withPreloading(PreloadAllModules)),
  ],
}
