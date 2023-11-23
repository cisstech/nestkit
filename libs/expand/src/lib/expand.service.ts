/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

import { DiscoveryService } from '@golevelup/nestjs-discovery'
import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common'
import { EXPANDABLE_KEY, EXPANDER_KEY, EXPAND_CONFIG, ExpandConfig, ExpandMethod, ExpandableParams } from './expand'
import { createObjectFromDotNotation } from './expand.utils'

@Injectable()
export class ExpandService implements OnModuleInit {
  private readonly logger = new Logger(ExpandService.name)
  private readonly expanders = new Map<Function, any>()

  constructor(
    private readonly discovery: DiscoveryService,
    @Optional()
    @Inject(EXPAND_CONFIG)
    private readonly config?: ExpandConfig
  ) {}

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

      if (this.config?.enableLogging) {
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
  async expand(request: any, resource: any, params: ExpandableParams): Promise<any> {
    try {
      const root = params.rootField ? resource[params.rootField] : resource
      if (!root) return resource

      const { query } = request
      if (!query.expands) return resource

      const expander = this.expanders.get(params.target)
      const properties =
        typeof query.expands === 'object' && !Array.isArray(query.expands)
          ? query.expands
          : createObjectFromDotNotation(query.expands)

      const recursiveExpand = async (parent: any) => {
        for (const prop in properties) {
          const method = expander[prop] as ExpandMethod
          if (!method) {
            this.logger.warn(`Expand: missing method ${prop} on ${params.target.name}`)
            continue
          }

          let value = await method.call(expander, { parent, request })

          const subProp = properties[prop]
          if (value && typeof subProp === 'object') {
            const recursive = Reflect.getMetadata(EXPANDABLE_KEY, method) as ExpandableParams
            if (recursive) {
              value = await this.expand(
                {
                  ...request,
                  query: {
                    ...request.query,
                    expands: {
                      ...subProp,
                      ...Object.keys(properties).reduce(
                        (acc, key) => ({ ...acc, [key]: true }),
                        {} as Record<string, boolean>
                      ),
                    },
                  },
                },
                value,
                recursive
              )
            } else {
              this.logger.warn(
                `Expand: missing @Expandable on ${params.target.name}.${prop} to recursively expand ${Object.keys(
                  subProp
                )}`
              )
            }
          }

          parent[prop] = value
        }
        return parent
      }

      const changes = await Promise.all((Array.isArray(root) ? root : [root]).map(recursiveExpand))

      const result = Array.isArray(root) ? changes : changes[0]

      return params.rootField ? { ...resource, [params.rootField]: result } : result
    } catch (error: any) {
      if (this.config?.enableLogging) {
        this.logger.error(`Error during expansion: ${error.message}`, error.stack)
      }
      throw error
    }
  }
}
