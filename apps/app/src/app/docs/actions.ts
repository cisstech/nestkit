import { NgeDocIcon, NgeDocLinAction, NgeDocSettings } from '@cisstech/nge/doc'

export const octicon = (name: string): NgeDocIcon => ({
  light: `https://icongr.am/octicons/${name}.svg?color=52525b`,
  dark: `https://icongr.am/octicons/${name}.svg?color=a1a1aa`,
})

export const editInGithubAction = (url: string) => {
  const base = 'https://github.com/cisstech/nestkit/tree/main/'
  return {
    title: 'Edit on github',
    icon: octicon('pencil'),
    run: base + url,
  } as NgeDocLinAction
}
