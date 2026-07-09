import { NgeDocSettings } from '@cisstech/nge/doc'
import { editInGithubAction } from './actions'

export const NestKitOverview: NgeDocSettings = {
  meta: {
    name: 'NestKit',
    root: '/docs/overview/',
    logo: 'assets/icons/nestjs.svg',
    repo: {
      name: 'nestkit',
      url: 'https://github.com/cisstech/nestkit',
    },
  },
  pages: [
    {
      title: 'Introduction',
      href: 'introduction',
      renderer: 'assets/docs/overview/introduction.md',
      actions: [editInGithubAction('apps/app/src/assets/docs/overview/introduction.md')],
    },
  ],
}
