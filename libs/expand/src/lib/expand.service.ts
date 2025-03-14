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
  SelectableParams,
} from './expand'
import { ExpansionThree, createExpansionThree, maskObjectWithThree } from './expand.utils'

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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const expands =
      query[
        expandable?.queryParamName ?? (this.conf.expandQueryParamName || DEFAULT_EXPAND_CONFIG.expandQueryParamName)
      ]
    const selects =
      query[
        selectable?.queryParamName ?? (this.conf.selectQueryParamName || DEFAULT_EXPAND_CONFIG.selectQueryParamName)
      ]
    if (!expands && !selects) return resource

    const response =
      expands && expandable
        ? await this.expandResource(request, resource, expandable, createExpansionThree(expands))
        : resource

    return selects && (selectable || this.config.enableGlobalSelection)
      ? this.selectResource(response, selectable, createExpansionThree(selects))
      : response
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

  private async transformResource(
    resource: any,
    parameters: SelectableParams | ExpandableParams | undefined,
    transformFn: (resource: any) => Promise<any>
  ) {
    if (!resource) return resource

    try {
      const root = parameters?.rootField ? resource[parameters.rootField] : resource
      if (!root) return resource

      const resources = Array.isArray(root) ? root : [root]
      const transformations = await Promise.all(resources.map(transformFn))

      const response = Array.isArray(root) ? transformations : transformations[0]
      return parameters?.rootField ? { ...resource, [parameters.rootField]: response } : response
    } catch (error: any) {
      if (this.conf?.enableLogging) {
        this.logger.error(`Error during transformation: ${error.message}`, error.stack)
      }
      throw error
    }
  }

  private selectResource(resource: any, selectable: SelectableParams | undefined, three: ExpansionThree) {
    return this.transformResource(resource, selectable, (parent) => {
      if (!parent) return parent
      return maskObjectWithThree(parent, three)
    })
  }

  private async expandResource(request: any, resource: any, expandable: ExpandableParams, three: ExpansionThree) {
    const expanders = this.expanders.get(expandable.target)
    if (!expanders) {
      // This should never happen because of the check in onModuleInit so we just log a warning
      this.logger.warn(`NestJsExpand missing expander for ${expandable.target.name}`)
      return resource
    }

    return this.transformResource(resource, expandable, async (parent: any) => {
      if (!parent) return parent

      const extraValues: Record<string, unknown> = {}

      for (const propName in three) {
        const expander = expanders?.find((e) => propName in e)
        if (!expander) {
          this.logger.warn(`NestJsExpand missing method "${propName}" on ${expandable.target.name}`)
          continue
        }

        const method = expander[propName]
        let value = await method.call(expander, { parent, request })

        const subThree = three[propName]
        if (value && typeof subThree === 'object') {
          const recursiveParams = this.getMethodExpandableMetadata(method) as ExpandableParams
          if (recursiveParams) {
            value = await this.expandResource(request, value, recursiveParams, subThree)
          } else {
            this.logger.warn(
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
}
