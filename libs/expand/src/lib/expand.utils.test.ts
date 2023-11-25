import { createExpansionThree, maskObjectWithThree } from './expand.utils'

describe('ExpandUtils', () => {
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
  })

  describe('maskObjectWithThree', () => {
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
})
