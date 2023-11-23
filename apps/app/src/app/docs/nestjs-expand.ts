import { NgeDocSettings } from '@cisstech/nge/doc'

export const NestJsExpandDoc: NgeDocSettings = {
  meta: {
    name: 'nestjs-expand',
    root: '/docs/nestjs-expand/',
    backUrl: '/',
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
    },
  ],
}
