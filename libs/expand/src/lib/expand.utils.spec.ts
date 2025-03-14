/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExpansionError } from './expand'
import { createExpansionThree, handleExpansionErrors, maskObjectWithThree } from './expand.utils'

describe('createExpansionThree', () => {
  it('should return the same object if it is already an ExpansionThree', () => {
    const input = { prop: true }
    expect(createExpansionThree(input)).toBe(input)
  })

  it('should expand the object from dot notation if it is a string', () => {
    const input = 'prop.subprop'
    const expectedOutput = { prop: { subprop: true } }
    expect(createExpansionThree(input)).toEqual(expectedOutput)
  })

  it('should expand the object from dot notation if it is an array', () => {
    const input = ['prop', 'subprop', 'customer', 'customer.address', 'customer.paymentMethods']
    const expectedOutput = { prop: true, subprop: true, customer: { address: true, paymentMethods: true } }
    expect(createExpansionThree(input)).toEqual(expectedOutput)
  })

  it('should handle selects operator', () => {
    const input = ['*', 'instructor.*', '-instructor.name', 'instructor.customer.id', 'instructor.customer.name']
    const expectedOutput = {
      '*': true,
      instructor: {
        '*': true,
        name: false,
        customer: {
          id: true,
          name: true,
        },
      },
    }
    expect(createExpansionThree(input)).toEqual(expectedOutput)
  })

  it('should throw error if contains too many *', () => {
    const input1 = ['**', 'instruction']
    const input2 = ['*', 'instructi*on*']

    expect(() => createExpansionThree(input1)).toThrow()
    expect(() => createExpansionThree(input2)).toThrow()
  })

  it('should throw error if contains both * and - operators', () => {
    const input = ['*', '-instruction*']
    expect(() => createExpansionThree(input)).toThrow()
  })

  it('should handle comma separated keys', () => {
    const input = '*,-description,instructor.*,-instructor.id,-instructor.bio,parent.title'
    const expectedOutput = {
      '*': true,
      description: false,
      instructor: {
        '*': true,
        id: false,
        bio: false,
      },
      parent: {
        title: true,
      },
    }
    expect(createExpansionThree(input)).toEqual(expectedOutput)
  })
})

describe('maskObjectWithThree', () => {
  const selectionTree = {
    '*': true,
    b: {
      d: {
        e: true,
      },
      g: true,
    },
    h: false,
  }

  it('should mask an object with a given selection three', () => {
    const targetObject = {
      a: 1,
      b: {
        c: 2,
        d: {
          e: 3,
          f: 4,
        },
        g: false,
      },
      h: 6,
    }

    const expected = {
      a: 1,
      b: {
        d: {
          e: 3,
        },
        g: false,
      },
    }

    const result = maskObjectWithThree(targetObject, selectionTree)

    expect(result).toEqual(expected)
  })

  it('should mask an object with a given selection three with nested objects', () => {
    const targetObject = {
      a: 1,
      b: {
        c: 2,
        d: {
          e: 3,
          f: 4,
        },
        g: 5,
      },
      h: 6,
    }

    const expected = {
      a: 1,
      b: {
        d: {
          e: 3,
        },
        g: 5,
      },
    }

    const result = maskObjectWithThree(targetObject, selectionTree)

    expect(result).toEqual(expected)
  })

  it('should mask an object with a given selection three with nested objects and arrays', () => {
    const targetObject = {
      a: 1,
      b: [
        {
          c: 2,
          d: {
            e: 3,
            f: 4,
          },
          g: 5,
        },
        {
          c: 6,
          d: {
            e: 7,
            f: 8,
          },
          g: 9,
        },
      ],
      h: 10,
    }

    const expected = {
      a: 1,
      b: [
        {
          d: {
            e: 3,
          },
          g: 5,
        },
        {
          d: {
            e: 7,
          },
          g: 9,
        },
      ],
    }

    const result = maskObjectWithThree(targetObject, selectionTree)

    expect(result).toEqual(expected)
  })

  it('should mask an object containing date fields with a given selection three', () => {
    const targetObject = {
      a: 1,
      b: {
        c: 2,
        d: {
          e: 3,
          f: 4,
        },
        g: new Date(),
      },
    }

    const expected = {
      a: 1,
      b: {
        d: {
          e: 3,
        },
        g: targetObject.b.g,
      },
    }

    const result = maskObjectWithThree(targetObject, selectionTree)

    expect(result).toEqual(expected)
  })

  it('should mask an object containing null and undefined fields with a given selection three', () => {
    const targetObject = {
      a: 1,
      b: {
        c: 2,
        d: {
          e: undefined,
          f: 4,
        },
        g: null,
      },
    }

    const expected = {
      a: 1,
      b: {
        d: {
          e: undefined,
        },
        g: null,
      },
    }

    const result = maskObjectWithThree(targetObject, selectionTree)

    expect(result).toEqual(expected)
  })

  it('should not mask an object with empty selection tree', () => {
    const targetObject = {
      a: 1,
      b: {
        c: 2,
        d: {
          e: 3,
          f: 4,
        },
        g: 5,
      },
      h: 6,
    }

    const expected = targetObject

    const result = maskObjectWithThree(targetObject, {})

    expect(result).toEqual(expected)
  })
})

describe('handleExpansionErrors', () => {
  it('should do nothing if no errors', () => {
    const result = { id: 1, name: 'test' } as any
    const errors = new Map<string, ExpansionError>()

    handleExpansionErrors(errors, result)

    expect(result._expansionErrors).toBeUndefined()
  })

  it('should do nothing if includeErrors is false', () => {
    const result = { id: 1, name: 'test' } as any
    const errors = new Map<string, ExpansionError>()
    errors.set('Test.field', { message: 'error message', path: 'Test.field' })

    handleExpansionErrors(errors, result, false)

    expect(result._expansionErrors).toBeUndefined()
  })

  it('should attach errors to object response', () => {
    const result = { id: 1, name: 'test' } as any
    const errors = new Map<string, ExpansionError>()
    errors.set('Test.field', { message: 'error message', path: 'Test.field' })

    handleExpansionErrors(errors, result)

    expect(result._expansionErrors).toBeDefined()
    expect(result._expansionErrors['Test.field']).toEqual({
      message: 'error message',
      path: 'Test.field',
    })
  })

  it('should attach errors to specific array items', () => {
    const result = [{ id: 1, name: 'item1' } as any, { id: 2, name: 'item2' } as any]

    const errors = new Map<string, ExpansionError>()
    errors.set('Test.field[0]', { message: 'error in item 0', path: 'Test.field[0]' })
    errors.set('Test.otherField[1]', { message: 'error in item 1', path: 'Test.otherField[1]' })

    handleExpansionErrors(errors, result)

    expect(result[0]._expansionErrors).toBeDefined()
    expect(result[0]._expansionErrors['Test.field']).toEqual({
      message: 'error in item 0',
      path: 'Test.field[0]',
    })

    expect(result[1]._expansionErrors).toBeDefined()
    expect(result[1]._expansionErrors['Test.otherField']).toEqual({
      message: 'error in item 1',
      path: 'Test.otherField[1]',
    })
  })

  it('should handle multiple errors for same array item', () => {
    const result = [{ id: 1, name: 'item1' } as any]

    const errors = new Map<string, ExpansionError>()
    errors.set('Test.field1[0]', { message: 'error 1', path: 'Test.field1[0]' })
    errors.set('Test.field2[0]', { message: 'error 2', path: 'Test.field2[0]' })

    handleExpansionErrors(errors, result)

    expect(result[0]._expansionErrors).toBeDefined()
    expect(Object.keys(result[0]._expansionErrors).length).toBe(2)
    expect(result[0]._expansionErrors['Test.field1']).toBeDefined()
    expect(result[0]._expansionErrors['Test.field2']).toBeDefined()
  })

  it('should ignore errors with invalid array indices', () => {
    const result = [{ id: 1 } as any]
    const errors = new Map<string, ExpansionError>()
    errors.set('Test.field[99]', { message: 'error message', path: 'Test.field[99]' })

    handleExpansionErrors(errors, result)

    // Error has index 99 but array only has 1 item, so no error should be attached
    expect(result[0]._expansionErrors).toBeUndefined()
  })
})
