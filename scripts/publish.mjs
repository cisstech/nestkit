import syncJson from 'sync-json'

import devkit from '@nx/devkit'
const { readCachedProjectGraph } = devkit

const graph = readCachedProjectGraph()

console.log('Listing libraries...')
const libs = Object.values(graph.nodes).filter(node => node.type === 'lib' && node.name !== 'root')
const libOutputPaths = libs.map(lib => lib.data?.targets?.build?.options?.outputPath)
console.log('Found libraries:', libOutputPaths)

console.log('Updating librairies "package.json" before publishing')
await new Promise((resolve, reject) => {
  syncJson('package.json', libOutputPaths.map(path => `${path}/package.json`), ['version', 'author', 'repository', 'bugs', 'license'], (error) => {
    if (error) {
      reject(error)
    } else {
      resolve()
    }
  })
})
