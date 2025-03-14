import { NgeDocLinAction, NgeDocSettings } from '@cisstech/nge/doc'

const editInGithubAction = (url: string) => {
  const base = 'https://github.com/cisstech/nestkit/tree/main/'
  return {
    title: 'Edit on github',
    icon: 'https://icongr.am/octicons/mark-github.svg',
    run: base + url,
  } as NgeDocLinAction
}

export const NestJsPgPubSubDoc: NgeDocSettings = {
  meta: {
    name: '@nestjs-pg-pubsub',
    root: '/docs/nestjs-pg-pubsub/',
    backUrl: '/',
    logo: 'assets/icons/nestjs.svg',
    repo: {
      name: 'nestjs-pg-pubsub',
      url: 'https://github.com/cisstech/nestkit/tree/main/libs/pg-pubsub',
    },
  },
  pages: [
    {
      title: 'Getting Started',
      href: 'getting-started',
      icon: 'https://icongr.am/octicons/rocket.svg',
      renderer: 'assets/docs/pg-pubsub/getting-started.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/getting-started.md')],
    },
    {
      title: 'Installation',
      href: 'installation',
      icon: 'https://icongr.am/octicons/package.svg',
      renderer: 'assets/docs/pg-pubsub/installation.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/installation.md')],
    },
    {
      title: 'Usage',
      href: 'usage',
      icon: 'https://icongr.am/octicons/code.svg',
      renderer: 'assets/docs/pg-pubsub/usage.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/usage.md')],
    },
    {
      title: 'Advanced Usage',
      href: 'advanced-usage',
      icon: 'https://icongr.am/octicons/tools.svg',
      renderer: 'assets/docs/pg-pubsub/advanced-usage.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/advanced-usage.md')],
    },
    {
      title: 'Sample Application',
      href: 'sample-application',
      icon: 'https://icongr.am/octicons/beaker.svg',
      renderer: 'assets/docs/pg-pubsub/sample-application.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/sample-application.md')],
    },
  ],
}
