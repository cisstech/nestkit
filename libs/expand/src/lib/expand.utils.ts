/* eslint-disable @typescript-eslint/no-explicit-any */

export const createObjectFromDotNotation = (keys: string | string[]): Record<string, any> => {
  const result: Record<string, any> = {}
  const array = Array.isArray(keys) ? keys : [keys]
  array.forEach((key) => {
    const parts = key.split('.')
    let currentLevel = result
    parts.forEach((part, index) => {
      if (typeof currentLevel[part] !== 'object') {
        // If the property doesn't exist, create an object for it
        currentLevel[part] = {}
      }
      // If it's the last part of the key, set the value to true
      if (index === parts.length - 1) {
        currentLevel[part] = true
      }
      // Move to the next level
      currentLevel = currentLevel[part]
    })
  })
  return result
}
