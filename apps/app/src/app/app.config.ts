import { ApplicationConfig } from '@angular/core'
import { provideAnimations } from '@angular/platform-browser/animations'
import { PreloadAllModules, provideRouter, withEnabledBlockingInitialNavigation, withPreloading } from '@angular/router'
import { appRoutes } from './app.routes'

import { provideHttpClient } from '@angular/common/http'
import { provideNgeDoc, withBrand, withEditLink, withSearchIndex, withSeo } from '@cisstech/nge/doc'
import {
  NgeMarkdownConfig,
  provideNgeMarkdown,
  withAdmonitions,
  withConfig,
  withEmoji,
  withIcons,
  withKatex,
  withLinkAnchor,
  withShiki,
  withTabbedSet,
  withThemes,
} from '@cisstech/nge/markdown'

export function markdownOptions(): NgeMarkdownConfig {
  return {
    // Align nge-markdown's dark detection with the class the doc theme toggles.
    darkThemeClassName: 'nge-doc-dark',
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideHttpClient(),
    provideNgeMarkdown(
      withConfig(markdownOptions),
      withThemes({ name: 'github', styleUrl: 'assets/vendors/nge/markdown/themes/github.css' }),
      withKatex(),
      withIcons(),
      withEmoji(),
      withTabbedSet(),
      withLinkAnchor(),
      withAdmonitions(),
      withShiki()
    ),
    provideNgeDoc(
      withBrand({ title: 'NestKit', icon: 'assets/icons/nestjs.svg', href: '/' }),
      withSeo({ url: 'https://cisstech.github.io/nestkit', image: 'assets/icons/nestjs.svg' }),
      withEditLink('https://github.com/cisstech/nestkit/edit/main/apps/app/public/docs'),
      withSearchIndex('docs/search.json')
    ),
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation(), withPreloading(PreloadAllModules)),
  ],
}
