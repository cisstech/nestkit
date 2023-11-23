/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { SetMetadata } from '@nestjs/common'

/**
 * Symbol key for metadata associated with expanders.
 */
export const EXPANDER_KEY = Symbol('EXPANDER')

/**
 * Symbol key for metadata associated with expandable parameters.
 */
export const EXPANDABLE_KEY = Symbol('EXPANDABLE')

/**
 * Represents the context in which an expansion is performed.
 * @typeparam TRequest - The type of the incoming request.
 * @typeparam TParentResource - The type of the parent resource being expanded.
 */
export type ExpandContext<TRequest = any, TParentResource = any> = {
  request: TRequest
  parent: TParentResource
}

/**
 * Represents a method that can be used for expanding a resource.
 */
export type ExpandMethod = (context: ExpandContext) => Promise<unknown>

/**
 * Represents parameters for making a class or method expandable.
 */
export type ExpandableParams = {
  target: Function
  rootField?: string
}

/**
 * Decorator function to mark a class as an expander.
 * @param target - The class to be marked as an expander.
 * @returns A metadata decorator.
 */
export const Expander = (target: Function) => SetMetadata(EXPANDER_KEY, target)

/**
 * Decorator function to mark a class or method as expandable.
 * @param target - The class or method to be marked as expandable.
 * @param config - Additional configuration for expandable parameters.
 * @returns A metadata decorator.
 */
export const Expandable = (target: Function, config?: Omit<ExpandableParams, 'target'>) =>
  SetMetadata<symbol, ExpandableParams>(EXPANDABLE_KEY, {
    target,
    ...config,
  })

/**
 * Injection token for the ExpandConfig.
 */
export const EXPAND_CONFIG = Symbol('EXPAND_CONFIG')

/**
 * Represents configuration for the ExpandModule.
 */
export type ExpandConfig = {
  /**
   * Whether to enable logging for the ExpandModule.
   */
  enableLogging?: boolean
}
