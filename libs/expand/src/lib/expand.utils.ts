/**
 * A recursive object representing the properties to expand.
 * Each property is either a boolean or another ExpandTree.
 */
export type ExpansionThree = {
  [key: string]: ExpansionThree | boolean
}

const expandThreeFromDotNotation = (keys: string | string[]): ExpansionThree => {
  const result: ExpansionThree = {}
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
      currentLevel = (currentLevel as ExpansionThree)[part] as ExpansionThree
    })
  })
  return result
}

/**
 * Creates an ExpansionThree from a string or array of strings.
 *
 * @remarks
 * This function assumes that the object is already an ExpansionThree if it's an object.
 * @returns An ExpansionThree.
 */
export const createExpansionThree = (object: string | string[] | ExpansionThree): ExpansionThree => {
  if (typeof object === 'string') {
    return expandThreeFromDotNotation(object)
  }

  if (Array.isArray(object)) {
    return expandThreeFromDotNotation(object)
  }

  return object
}
