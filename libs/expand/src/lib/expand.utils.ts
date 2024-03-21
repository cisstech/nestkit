/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A recursive object representing the properties to expand.
 * Each property is either a boolean or another ExpandTree.
 */
export type ExpansionThree = {
  [key: string]: ExpansionThree | boolean
}

const MINUS_OPERATOR = '-'
const WILDCARD_OPERATOR = '*'

const expandThreeFromDotNotation = (keys: string | string[]): ExpansionThree => {
  const result: ExpansionThree = {}
  const array = Array.isArray(keys) ? keys : [keys]

  const mergedCommaSeparatedKeys = array
    .map((key) => key.trim().split(','))
    .filter(Boolean)
    .reduce((acc, val) => acc.concat(val), [])

  mergedCommaSeparatedKeys.forEach((key) => {
    const wildcards = key.match(/\*/g)?.length ?? 0
    if (wildcards > 1) {
      throw new Error(`NestJsExpand: key "${key}" cannot have more than on occurence of "${WILDCARD_OPERATOR}".`)
    }

    if (key.includes(MINUS_OPERATOR) && key.includes(WILDCARD_OPERATOR)) {
      throw new Error(
        `NestJsExpand: key "${key}" cannot contains both wildcard "${WILDCARD_OPERATOR}" and minus "${MINUS_OPERATOR}" operators.`
      )
    }

    const parts = key.replace(MINUS_OPERATOR, '').split('.')
    let currentLevel = result
    parts.forEach((part, index) => {
      if (typeof currentLevel[part] !== 'object') {
        // If the property doesn't exist, create an object for it
        currentLevel[part] = {}
      }
      // If it's the last part of the key, set the value to true
      if (index === parts.length - 1) {
        currentLevel[part] = !key.startsWith(MINUS_OPERATOR)
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
export const createExpansionThree = (object?: string | string[] | ExpansionThree): ExpansionThree => {
  if (!object) return {}

  if (typeof object === 'string') {
    return expandThreeFromDotNotation(object)
  }

  if (Array.isArray(object)) {
    return expandThreeFromDotNotation(object)
  }

  return object
}

/**
 * Masks an object with a given selection three.
 *
 * @example
 * ```ts
 *
 * const targetObject = {
 *  a: 1,
 *  b: {
 *    c: 2,
 *    d: {
 *      e: 3,
 *      f: 4,
 *    },
 *    g: 5,
 *  },
 *  h: 6,
 * }
 *
 * const selectionTree = {
 *  '*': true,
 *   b: {
 *    d: {
 *      e: true,
 *    },
 *    g: true,
 *   },
 *   h: false
 * }
 *
 * const result = maskObjectWithThree(targetObject, selectionTree)
 *
 * // result = {
 * //   a: 1,
 * //   b: {
 * //     d: {
 * //       e: 3,
 * //     },
 * //     g: 5,
 * //   }
 * // }
 * ```
 *
 * @param target - The object to be masked.
 * @param selection - The selection criteria for masking.
 * @returns The masked object.
 */
export const maskObjectWithThree = (target: any, selection: ExpansionThree): any => {
  const maskObjectWithThreeRecursive = (currentTarget: any, currentSelection: ExpansionThree): any => {
    if (currentTarget == null) return currentTarget

    const result: any = {}

    if (WILDCARD_OPERATOR in currentSelection) {
      // add all keys expect explicitly excluded ones
      const targetKeys = Object.keys(currentTarget)
      targetKeys.forEach((key) => {
        if (currentSelection[key] !== false) {
          result[key] = currentTarget[key]
        }
      })
    }

    const selectKeys = Object.keys(currentSelection).filter((key) => key !== WILDCARD_OPERATOR)
    for (const selectKey of selectKeys) {
      if (!currentSelection[selectKey]) continue // explicit select false
      if (!(selectKey in currentTarget)) continue // select does not exists on target

      const value =
        typeof currentSelection[selectKey] === 'object'
          ? maskObjectWithThreeRecursive(currentTarget[selectKey], currentSelection[selectKey] as ExpansionThree)
          : currentTarget[selectKey]

      if (value != null) {
        result[selectKey] = value
      }
    }

    return result
  }
  return maskObjectWithThreeRecursive(target, selection)
}
