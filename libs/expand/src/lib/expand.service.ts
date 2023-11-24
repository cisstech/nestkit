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
} from './expand'
import { ExpansionThree, createExpansionThree } from './expand.utils'

@Injectable()
export class ExpandService implements OnModuleInit {
  private readonly logger = new Logger(ExpandService.name)
  private readonly expanders = new Map<Function, any>()

  get config(): Readonly<ExpandConfig> {
    return this.conf
  }

  constructor(
    private readonly discovery: DiscoveryService,
    @Optional()
    @Inject(EXPAND_CONFIG)
    readonly conf: ExpandConfig
  ) {
    this.conf = { ...DEFAULT_EXPAND_CONFIG, ...conf }
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
        this.expanders.set(expander.meta, expander.discoveredClass.instance)
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
        throw new Error('Expand: missing providers with @RegisterExpander for : ' + missing)
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
   * Expands properties of a resource based on the provided parameters.
   * @param request - The incoming request object.
   * @param resource - The resource to be expanded.
   * @param params - The parameters for expansion, including the target class and rootField.
   * @returns The expanded resource.
   * @throws Error if there's an issue during the expansion process.
   */
  async expand<T = any>(request: any, resource: any, params: ExpandableParams): Promise<T> {
    const recursive = async (request: any, resource: any, params: ExpandableParams, three: ExpansionThree) => {
      try {
        const root = params.rootField ? resource[params.rootField] : resource
        if (!root) {
          this.logger.log(`Expand: nothing to expand on ${params.target.name}`)
          return resource
        }

        const expander = this.expanders.get(params.target) as Record<string, ExpandMethod>
        if (!expander) {
          // This should never happen because of the check in onModuleInit so we just log a warning
          this.logger.warn(`Expand: missing expander for ${params.target.name}`)
          return resource
        }

        const resources = Array.isArray(root) ? root : [root]
        const changes = await Promise.all(
          resources.map(async (parent: any) => {
            const extraValues: Record<string, unknown> = {}

            for (const propName in three) {
              const method = expander[propName]

              if (!method) {
                this.logger.warn(`Expand: missing method ${propName} on ${params.target.name}`)
                continue
              }

              let value = await method.call(expander, { parent, request })

              const propValue = three[propName]
              if (value && typeof propValue === 'object') {
                const recursiveParams = this.getMethodExpandableMetadata(method) as ExpandableParams
                if (recursiveParams) {
                  value = await recursive(request, value, recursiveParams, propValue)
                } else {
                  this.logger.warn(
                    `Expand: missing @Expandable on ${
                      params.target.name
                    }.${propName} to recursively expand ${Object.keys(three)}`
                  )
                }
              }

              extraValues[propName] = value
            }

            return { ...parent, ...extraValues }
          })
        )

        const result = Array.isArray(root) ? changes : changes[0]

        return params.rootField ? { ...resource, [params.rootField]: result } : result
      } catch (error: any) {
        if (this.conf?.enableLogging) {
          this.logger.error(`Error during expansion: ${error.message}`, error.stack)
        }
        throw error
      }
    }

    const { query } = request
    const expands = query[this.conf.expandQueryParamName!]
    if (!expands) return resource
    return recursive(request, resource, params, createExpansionThree(expands))
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
}
