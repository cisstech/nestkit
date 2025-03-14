/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

import { DiscoveryService } from '@golevelup/nestjs-discovery'
import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common'
import {
  DEFAULT_EXPAND_CONFIG,
  EXPANDABLE_KEY,
  EXPANDER_KEY,
  EXPAND_CONFIG,
  ExpandConfig,
  ExpandMethod,
  ExpandableParams,
  ExpansionError,
  SelectableParams,
} from './expand'
import { ExpansionThree, createExpansionThree, handleExpansionErrors, maskObjectWithThree } from './expand.utils'

@Injectable()
export class ExpandService implements OnModuleInit {
  private readonly logger = new Logger(ExpandService.name)
  private readonly expanders = new Map<Function, Record<string, ExpandMethod>[]>()

  /**
   * The configuration for the module.
   */
  get config(): Readonly<ExpandConfig> {
    return this.conf
  }

  constructor(
    private readonly discovery: DiscoveryService,
    @Optional()
    @Inject(EXPAND_CONFIG)
    private readonly conf: ExpandConfig
  ) {
    this.conf = { ...DEFAULT_EXPAND_CONFIG, ...conf }

    // Ensure we have errorHandling object with defaults
    this.conf.errorHandling = {
      ...DEFAULT_EXPAND_CONFIG.errorHandling,
      ...conf?.errorHandling,
    }
  }

  /**
   * Lifecycle hook to be called once the module has been initialized.
   * It discovers expanders and expandable methods/controllers using the DiscoveryService.
   * It associates discovered expanders with their respective classes.
   * It checks for missing providers with @RegisterExpander for expandable methods/controllers.
   */
  async onModuleInit(): Promise<void> {
    try {
      const [expanders, expandables] = await Promise.all([
        this.discovery.providersWithMetaAtKey<Function>(EXPANDER_KEY),
        this.discovery.methodsAndControllerMethodsWithMetaAtKey<ExpandableParams>(EXPANDABLE_KEY),
      ])

      expanders.forEach((expander) => {
        const existing = this.expanders.get(expander.meta) ?? []
        existing.push(expander.discoveredClass.instance as Record<string, ExpandMethod>)
        this.expanders.set(expander.meta, existing)
      })

      const missing = expandables
        .filter((expandable) => {
          return !this.expanders.has(expandable.meta.target)
        })
        .map((expandable) => {
          const { methodName, parentClass } = expandable.discoveredMethod
          return `${expandable.meta.target.name} used in ${parentClass.name}.${methodName}`
        })

      if (missing.length) {
        throw new Error('missing providers with @RegisterExpander for : ' + missing)
      }

      if (this.conf?.enableLogging) {
        this.logger.log('Expansion logging is enabled.')
      }
    } catch (error: any) {
      this.logger.error(`Error during module initialization: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * Expands/selects properties of a resource based on the provided parameters.
   * @param request - The incoming request object.
   * @param resource - The resource to be expanded.
   * @param expandable - The parameters for expansion, including the target class and rootField.
   * @returns The expanded resource.
   * @throws Error if there's an issue during the expansion process.
   */
  async expandAndSelect<T = any>(
    request: any,
    resource: any,
    expandable?: ExpandableParams,
    selectable?: SelectableParams
  ): Promise<T> {
    const { query } = request
    if (!query) return resource

    const expands =
      query[
        expandable?.queryParamName ?? (this.conf.expandQueryParamName || DEFAULT_EXPAND_CONFIG.expandQueryParamName)
      ]
    const selects =
      query[
        selectable?.queryParamName ?? (this.conf.selectQueryParamName || DEFAULT_EXPAND_CONFIG.selectQueryParamName)
      ]
    if (!expands && !selects) return resource

    // Create an error map specific to this request (concurrency-safe)
    const expansionErrors = new Map<string, ExpansionError>()

    const response =
      expands && expandable
        ? await this.expandResource(request, resource, expandable, createExpansionThree(expands), expansionErrors)
        : resource

    const result =
      selects && (selectable || this.config.enableGlobalSelection)
        ? this.selectResource(response, selectable, createExpansionThree(selects))
        : response

    // If we have errors and error inclusion is enabled, add them to the response
    handleExpansionErrors(
      expansionErrors,
      expandable?.rootField ? result[expandable.rootField] : result,
      this.config.errorHandling?.includeErrorsInResponse
    )

    return result as T
  }

  /**
   * Returns the @Expandable metadata for a given method using the Reflect API.
   * @remarks
   * This method is used internally as a wrapper around Reflect.getMetadata to make testing easier.
   * @param target - The method to be inspected.
   * @returns The @Expandable metadata for the given method or undefined if none is found.
   */
  getMethodExpandableMetadata(target: Function): ExpandableParams | undefined {
    return Reflect.getMetadata(EXPANDABLE_KEY, target)
  }

  private log(level: 'debug' | 'log' | 'warn' | 'error', message: string, ...optionalParams: any[]): void {
    if (!this.conf.logLevel || this.conf.logLevel === 'none') return

    // Only log if the configured log level is high enough
    const levels = ['debug', 'log', 'warn', 'error']
    if (levels.indexOf(this.conf.logLevel) <= levels.indexOf(level)) {
      this.logger[level](message, ...optionalParams)
    }
  }

  private async transformResource(
    resource: any,
    parameters: SelectableParams | ExpandableParams | undefined,
    transformFn: (resource: any, index?: number) => Promise<any>
  ) {
    if (!resource) return resource

    try {
      const root = parameters?.rootField ? resource[parameters.rootField] : resource
      if (!root) return resource

      const resources = Array.isArray(root) ? root : [root]
      // Pass array index to transformFn for tracking errors with specific items
      const transformations = await Promise.all(
        resources.map((res, index) => transformFn(res, Array.isArray(root) ? index : undefined))
      )

      const response = Array.isArray(root) ? transformations : transformations[0]
      return parameters?.rootField ? { ...resource, [parameters.rootField]: response } : response
    } catch (error: any) {
      if (this.conf?.enableLogging) {
        this.log('error', `Error during transformation: ${error.message}`, error.stack)
      }
      throw error
    }
  }

  private async expandResource(
    request: any,
    resource: any,
    expandable: ExpandableParams,
    three: ExpansionThree,
    expansionErrors: Map<string, ExpansionError>
  ) {
    const expanders = this.expanders.get(expandable.target)
    if (!expanders) {
      // This should never happen because of the check in onModuleInit so we just log a warning
      this.log('warn', `NestJsExpand missing expander for ${expandable.target.name}`)
      return resource
    }

    return this.transformResource(resource, expandable, async (parent: any, index?: number) => {
      if (!parent) return parent

      const extraValues: Record<string, unknown> = {}

      for (const propName in three) {
        const expander = expanders?.find((e) => propName in e)
        if (!expander) {
          this.log('warn', `NestJsExpand missing method "${propName}" on ${expandable.target.name}`)
          continue
        }

        const method = expander[propName]
        let value: any
        // Include index in the path if available, for tracking array item errors
        const expansionPath =
          typeof index === 'number'
            ? `${expandable.target.name}.${propName}[${index}]`
            : `${expandable.target.name}.${propName}`

        // Default error policy from module config or 'ignore'
        const defaultErrorPolicy = this.conf.errorHandling?.defaultErrorPolicy || 'ignore'

        // Get error policy from expandable params or use default
        const errorPolicy = expandable.errorPolicy || defaultErrorPolicy

        try {
          value = await method.call(expander, { parent, request })
        } catch (error: any) {
          // Create formatted error using the configured formatter
          const formatter =
            this.conf.errorHandling?.errorResponseShape || DEFAULT_EXPAND_CONFIG.errorHandling.errorResponseShape!
          const formattedError = formatter(error, expansionPath)

          // Store the error for potential inclusion in the response
          expansionErrors.set(expansionPath, {
            message: formattedError.message || error.message,
            path: expansionPath,
            ...(formattedError.stack && { stack: formattedError.stack }),
          })

          // Handle error according to the policy
          if (errorPolicy === 'throw') {
            throw error
          }

          this.log('warn', `Error during expansion of ${expansionPath}: ${error.message}`, error.stack)
          continue // Skip further processing of this field
        }

        const subThree = three[propName]
        if (value && typeof subThree === 'object') {
          const recursiveParams = this.getMethodExpandableMetadata(method) as ExpandableParams
          if (recursiveParams) {
            value = await this.expandResource(request, value, recursiveParams, subThree, expansionErrors)
          } else {
            this.log(
              'warn',
              `NestJsExpand missing @Expandable on ${
                expandable.target.name
              }.${propName} to recursively expand ${Object.keys(three)}`
            )
          }
        }

        extraValues[propName] = value
      }

      return { ...parent, ...extraValues }
    })
  }

  private selectResource(resource: any, selectable: SelectableParams | undefined, three: ExpansionThree) {
    return this.transformResource(resource, selectable, (parent) => {
      if (!parent) return parent
      return maskObjectWithThree(parent, three)
    })
  }
}
