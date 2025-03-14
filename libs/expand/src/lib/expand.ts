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
 * Symbol key for metadata associated with selectable parameters.
 */
export const SELECTABLE_KEY = Symbol('SELECTABLE')

/**
 * Represents the context in which an expansion is performed.
 * @typeparam TRequest - The type of the incoming request.
 * @typeparam TParentResource - The type of the parent resource being expanded.
 */
export type ExpandContext<TRequest = any, TParentResource = any> = {
  /**
   * The incoming request object.
   */
  request: TRequest

  /**
   * The parent resource being expanded.
   */
  parent: TParentResource
}

/**
 * Represents a method that can be used for expanding a resource.
 */
export type ExpandMethod = (context: ExpandContext) => Promise<unknown>

/**
 * Represents parameters for making a controller/expander response expandable.
 */
export type ExpandableParams = {
  /**
   * The DTO class to be expanded.
   */
  target: Function

  /**
   * The name of the field containing the dto to expand from the request response.
   * This is useful when the dto is wrapped in a response object like in listing endpoints where the dto is in the `items` field
   * along with other metadata like `count` and `total`.
   */
  rootField?: string

  /**
   * Overrides {@link ExpandConfig.expandQueryParamName} value for this endpoint.
   *
   * @remarks
   * - This is useful when you want to have different query parameter names for different endpoints.
   * - This is ignored if applied to a class decorated with `@Expander` since only root Expandable method are direclty linked to the incoming request.
   */
  queryParamName?: string

  /**
   * Specify the error policy for this expandable endpoint.
   * @default The module's defaultErrorPolicy or 'ignore'
   */
  errorPolicy?: ExpandErrorPolicy
}

/**
 * Represents parameters for making a controller response selectable.
 */
export type SelectableParams = {
  /**
   * The name of the field containing the dto to select from the request response.
   * This is useful when the dto is wrapped in a response object like in listing endpoints where the dto is in the `items` field
   * along with other metadata like `count` and `total`.
   */
  rootField?: string

  /**
   * Overrides {@link ExpandConfig.selectQueryParamName} value for this endpoint.
   */
  queryParamName?: string
}

/**
 * Represents configuration for the ExpandModule.
 */
export type ExpandConfig = {
  /**
   * Whether to enable logging for the ExpandModule.
   * @default `true`
   */
  enableLogging?: boolean

  /**
   * Whether to enable global selection for all endpoints.
   */
  enableGlobalSelection?: boolean

  /**
   * The name of the query parameter to use for selecting fields.
   * A comma-separated list of fields can be provided.
   * For example, `?selects=field1,field2`
   *
   * @remarks
   * - nested fields can be selected using dot notation (e.g. `?selects=field1.nestedField`)
   * - fields can be excluded by prefixing them with a minus sign (e.g. `?selects=-field1`)
   * - wildcards can be used to select all fields of a given type on each level including the root level (e.g. `?selects=field1.*`)
   * ``
   * @default `selects`
   */
  selectQueryParamName?: string

  /**
   * The name of the query parameter to use for expanding resources.
   * @default `expands`
   */
  expandQueryParamName?: string

  /**
   * Configure error handling for expansions.
   */
  errorHandling?: ExpansionErrorHandlingConfig

  /**
   * Log level for expansion logs.
   * @default 'warn'
   */
  logLevel?: 'debug' | 'log' | 'warn' | 'error' | 'none'
}

/**
 * Error policy for expansion errors.
 * - 'ignore': Ignore errors and continue with the expansion (default)
 * - 'include': Include error details in the response
 * - 'throw': Throw the error and interrupt the entire request
 */
export type ExpandErrorPolicy = 'ignore' | 'include' | 'throw'

/**
 * Represents error metadata for failed expansions.
 */
export type ExpansionError = {
  message: string
  path: string
  stack?: string
}

/**
 * Format function for expansion errors.
 */
export type ExpansionErrorFormatter = (error: Error, path: string) => Partial<ExpansionError>

/**
 * Error handling configuration for expansions.
 */
export type ExpansionErrorHandlingConfig = {
  /**
   * Whether to include error metadata in the response.
   * @default false
   */
  includeErrorsInResponse?: boolean

  /**
   * Custom formatter for expansion errors.
   * @default (error, path) => ({ message: error.message, path })
   */
  errorResponseShape?: ExpansionErrorFormatter

  /**
   * Default error policy for all expansions.
   * @default 'ignore'
   */
  defaultErrorPolicy?: ExpandErrorPolicy
}

/**
 * Decorator function to mark a class as an expander.
 *
 * @remarks
 * - The class must be a NestJS provider.
 *
 * @param target - The DTO class to be expanded.
 * @returns A metadata decorator.
 */
export const Expander = (target: Function) => SetMetadata(EXPANDER_KEY, target)

/**
 * Decorator controller/expander method as expandable.
 *
 * @remarks
 * - The method must be a controller endpoint or a method of a class decorated with `@Expander`.
 *
 * @param target - The class or method to be marked as expandable.
 * @param config - Additional configuration for expandable parameters.
 * @returns A metadata decorator.
 */
export const Expandable = (target: Function, config?: Omit<ExpandableParams, 'target'>) =>
  SetMetadata(EXPANDABLE_KEY, { target, ...config })

/**
 * Decorator function to mark a class or method as selectable.
 *
 * @remarks
 * - You can mark all endpoints of your app as selectable by setting the {@link ExpandConfig.enableGlobalSelection} option of the `NestKitExpandModule.forRoot()`.
 *
 * @returns A metadata decorator.
 */
export const Selectable = (config?: SelectableParams) => SetMetadata(SELECTABLE_KEY, config ?? {})

/**
 * Injection token for the ExpandConfig.
 */
export const EXPAND_CONFIG = Symbol('EXPAND_CONFIG')

export const DEFAULT_EXPAND_CONFIG: Required<ExpandConfig> = {
  enableLogging: true,
  enableGlobalSelection: false,
  selectQueryParamName: 'selects',
  expandQueryParamName: 'expands',
  logLevel: 'warn',
  errorHandling: {
    includeErrorsInResponse: false,
    defaultErrorPolicy: 'ignore',
    errorResponseShape: (error, path) => ({
      message: error.message,
      path,
    }),
  },
}
