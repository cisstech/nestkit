/* eslint-disable @typescript-eslint/no-explicit-any */

import { ExpansionError } from './expand'

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
 * @remarks
 * - Empty selection tree will return the target object as is.
 * - Array values are also supported. The selection tree at the array level will be applied to each item in the array.
 * - If a key is not present in the selection tree, it will be excluded from the result.
 * - `null` or `undefined` values will be returned as is.
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

    // If the selection is empty, return the target as is
    const selectionKeys = Object.keys(currentSelection)
    if (selectionKeys.length === 0) return currentTarget

    if (Array.isArray(currentTarget)) {
      return currentTarget.map((item) => maskObjectWithThreeRecursive(item, currentSelection))
    }

    const maskedTarget: any = {}

    // add all keys expect explicitly excluded ones if wildcard is present
    if (WILDCARD_OPERATOR in currentSelection) {
      const targetKeys = Object.keys(currentTarget)
      targetKeys.forEach((key) => {
        if (currentSelection[key] !== false) {
          maskedTarget[key] = currentTarget[key]
        }
      })
    }

    // handle explicit keys and minus operator
    const selectKeys = selectionKeys.filter((key) => key !== WILDCARD_OPERATOR)
    for (const selectKey of selectKeys) {
      if (!currentSelection[selectKey]) continue // explicit select false
      if (!(selectKey in currentTarget)) continue // select does not exists on target

      const value =
        typeof currentSelection[selectKey] === 'object'
          ? maskObjectWithThreeRecursive(currentTarget[selectKey], currentSelection[selectKey] as ExpansionThree)
          : currentTarget[selectKey]

      maskedTarget[selectKey] = value
    }

    return maskedTarget
  }
  return maskObjectWithThreeRecursive(target, selection)
}

/**
 * Handle expansion errors by attaching them to the response object.
 * For arrays, errors will be attached to individual items.
 * For objects, errors will be attached to the object directly.
 *
 * @param expansionErrors - Map of errors with their paths
 * @param result - Result object to attach errors to
 * @param includeErrors - Whether to include errors in the response
 */
export const handleExpansionErrors = (
  expansionErrors: Map<string, ExpansionError>,
  result: any,
  includeErrors = true
): void => {
  if (expansionErrors.size === 0 || !includeErrors) return

  if (Array.isArray(result)) {
    // For array responses, attach errors to individual items
    // This requires the error path to include enough information to identify the item
    const errorsByItemIndex = new Map<number, Record<string, ExpansionError>>()

    // Group errors by item index
    for (const [path, error] of expansionErrors.entries()) {
      // Extract the index from the path if available
      // Format expected: path.to.property[index]
      const indexMatch = path.match(/\[(\d+)\]/)
      if (indexMatch && indexMatch[1]) {
        const index = parseInt(indexMatch[1], 10)
        if (!errorsByItemIndex.has(index)) {
          errorsByItemIndex.set(index, {})
        }

        // Replace the indexed part in the path with empty string
        const cleanPath = path.replace(/\[\d+\]/, '')
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        errorsByItemIndex.get(index)![cleanPath] = error
      }
    }

    // Attach errors to individual items
    errorsByItemIndex.forEach((errors, index) => {
      if (index < result.length && Object.keys(errors).length > 0) {
        result[index]._expansionErrors = errors
      }
    })
  } else if (result && typeof result === 'object') {
    // For object responses, add errors as a property
    const errors = Object.fromEntries(expansionErrors.entries())
    result._expansionErrors = errors
  }
}
