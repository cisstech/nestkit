import { NgeDocSettings } from '@cisstech/nge/doc'
import { editInGithubAction } from './actions'

export const NestJsExpandDoc: NgeDocSettings = {
  meta: {
    name: '@nestjs-expand',
    root: '/docs/nestjs-expand/',
    backUrl: '/',
    logo: 'assets/icons/nestjs.svg',
    repo: {
      name: 'nestjs-expand',
      url: 'https://github.com/cisstech/nestkit/tree/main/libs/expand',
    },
  },
  pages: [
    {
      title: 'Getting Started',
      href: 'getting-started',
      renderer: 'assets/docs/nestjs-expand/getting-started.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/getting-started.md')],
    },
    {
      title: 'Installation',
      href: 'installation',
      renderer: 'assets/docs/nestjs-expand/installation.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/installation.md')],
    },
    {
      title: 'Usage',
      href: 'usage',
      renderer: 'assets/docs/nestjs-expand/usage.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/usage.md')],
    },
    {
      title: 'Advanced Usage',
      href: 'advanced-usage',
      renderer: 'assets/docs/nestjs-expand/advanced-usage.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/advanced-usage.md')],
    },
    {
      title: 'Error Handling',
      href: 'error-handling',
      renderer: 'assets/docs/nestjs-expand/error-handling.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/error-handling.md')],
    },
  ],
}
