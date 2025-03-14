import { NgeDocLinAction, NgeDocSettings } from '@cisstech/nge/doc'

const editInGithubAction = (url: string) => {
  const base = 'https://github.com/cisstech/nestkit/tree/main/'
  return {
    title: 'Edit on github',
    icon: 'https://icongr.am/octicons/mark-github.svg',
    run: base + url,
  } as NgeDocLinAction
}

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
      icon: 'https://icongr.am/octicons/rocket.svg',
      renderer: 'assets/docs/nestjs-expand/getting-started.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/getting-started.md')],
    },
    {
      title: 'Installation',
      href: 'installation',
      icon: 'https://icongr.am/octicons/package.svg',
      renderer: 'assets/docs/nestjs-expand/installation.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/installation.md')],
    },
    {
      title: 'Usage',
      href: 'usage',
      icon: 'https://icongr.am/octicons/code.svg',
      renderer: 'assets/docs/nestjs-expand/usage.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/usage.md')],
    },
    {
      title: 'Advanced Usage',
      href: 'advanced-usage',
      icon: 'https://icongr.am/octicons/tools.svg',
      renderer: 'assets/docs/nestjs-expand/advanced-usage.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/advanced-usage.md')],
    },
    {
      title: 'Error Handling',
      href: 'error-handling',
      icon: 'https://icongr.am/octicons/alert.svg',
      renderer: 'assets/docs/nestjs-expand/error-handling.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/nestjs-expand/error-handling.md')],
    },
  ],
}
