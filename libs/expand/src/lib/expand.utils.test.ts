import { createExpansionThree } from './expand.utils'

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
})
