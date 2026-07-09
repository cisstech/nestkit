import { NgeDocSettings } from '@cisstech/nge/doc'
import { editInGithubAction, octicon } from './actions'

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
      icon: octicon('rocket'),
      renderer: 'assets/docs/pg-pubsub/getting-started.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/getting-started.md')],
    },
    {
      title: 'Installation',
      href: 'installation',
      icon: octicon('package'),
      renderer: 'assets/docs/pg-pubsub/installation.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/installation.md')],
    },
    {
      title: 'Usage',
      href: 'usage',
      icon: octicon('code'),
      renderer: 'assets/docs/pg-pubsub/usage.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/usage.md')],
    },
    {
      title: 'Advanced Usage',
      href: 'advanced-usage',
      icon: octicon('tools'),
      renderer: 'assets/docs/pg-pubsub/advanced-usage.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/advanced-usage.md')],
    },
    {
      title: 'Sample Application',
      href: 'sample-application',
      icon: octicon('beaker'),
      renderer: 'assets/docs/pg-pubsub/sample-application.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/pg-pubsub/sample-application.md')],
    },
  ],
}
