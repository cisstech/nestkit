/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DiscoveryService } from '@golevelup/nestjs-discovery'
import { Inject, Injectable, Logger, OnModuleInit, Optional, Type } from '@nestjs/common'
import 'reflect-metadata'
import {
  DEFAULT_EXPAND_CONFIG,
  EXPANDABLE_KEY,
  EXPANDER_KEY,
  EXPANDER_METHODS_KEY,
  EXPAND_CONFIG,
  ExpandConfig,
  ExpandContext,
  ExpandableParams,
  ExpansionError, // Updated key
  ReusableExpandMethod,
  SelectableParams,
  StandardExpandMethod,
  USE_EXPANSION_METHOD_KEY,
  UseExpansionMethodMetadata,
} from './expand'
import { ExpansionThree, createExpansionThree, handleExpansionErrors, maskObjectWithThree } from './expand.utils'

// Helper type for storing discovered reusable expander info
type DiscoveredExpanderMethods = {
  instance: any
  meta: any // Metadata from @ExpanderMethods (currently unused but available)
}

// Helper type for storing discovered @UseExpansionMethod metadata, grouped by Expander class
type ExpanderMethodLinks = Map<string, UseExpansionMethodMetadata> // fieldName -> metadata

@Injectable()
export class ExpandService implements OnModuleInit {
  private readonly logger = new Logger(ExpandService.name)
  // Stores standard expanders: DTO Class -> Array of Expander Instances
  private readonly standardExpanders = new Map<Function, Record<string, StandardExpandMethod>[]>()
  // Stores reusable expander instances: Reusable Class -> Instance Info
  private readonly expanderMethodsInstances = new Map<Function, DiscoveredExpanderMethods>()
  // Stores links from standard expanders to reusable methods: Expander Class -> Map<fieldName, UseExpansionMethodMetadata>
  private readonly expansionMethodLinks = new Map<Function, ExpanderMethodLinks>()

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
    this.conf.errorHandling = {
      ...DEFAULT_EXPAND_CONFIG.errorHandling,
      ...conf?.errorHandling,
    }
  }

  /**
   * Lifecycle hook to discover standard expanders, reusable expanders,
   * and the links (@UseExpansionMethod) between them.
   */
  async onModuleInit(): Promise<void> {
    try {
      const [standardExpandersMeta, expanderMethodsMeta, expandablesMeta] = await Promise.all([
        this.discovery.providersWithMetaAtKey<Function>(EXPANDER_KEY),
        this.discovery.providersWithMetaAtKey<any>(EXPANDER_METHODS_KEY),
        this.discovery.methodsAndControllerMethodsWithMetaAtKey<ExpandableParams>(EXPANDABLE_KEY),
      ])

      // Process standard expanders
      standardExpandersMeta.forEach((expander) => {
        const dtoClass = expander.meta
        const instance = expander.discoveredClass.instance as Record<string, StandardExpandMethod>
        const existing = this.standardExpanders.get(dtoClass) ?? []
        existing.push(instance)
        this.standardExpanders.set(dtoClass, existing)

        // Discover @UseExpansionMethod metadata on this standard expander class
        const methodLinks = this.discoverExpansionMethodLinks(expander.discoveredClass.injectType as Type<any>)
        if (methodLinks.size > 0) {
          this.expansionMethodLinks.set(expander.discoveredClass.injectType as Function, methodLinks)
        }
      })

      // Process reusable expander methods classes
      expanderMethodsMeta.forEach((expander) => {
        this.expanderMethodsInstances.set(expander.discoveredClass.injectType as Function, {
          instance: expander.discoveredClass.instance,
          meta: expander.meta,
        })
      })

      // Validation: Check if @Expandable targets have corresponding standard expanders registered
      const missingStandardExpanders = expandablesMeta
        .filter((expandable) => !this.standardExpanders.has(expandable.meta.target))
        .map((expandable) => {
          const { methodName, parentClass } = expandable.discoveredMethod
          return `${expandable.meta.target.name} used in ${parentClass.name}.${methodName}`
        })

      if (missingStandardExpanders.length) {
        throw new Error(`Missing providers decorated with @Expander for: ${missingStandardExpanders.join(', ')}`)
      }

      // Validation: Check if @UseExpansionMethod references existing @ExpanderMethods classes
      this.expansionMethodLinks.forEach((links, expanderClass) => {
        links.forEach((linkMeta) => {
          // Access properties via the config object
          if (!this.expanderMethodsInstances.has(linkMeta.class)) {
            throw new Error(
              `Class ${linkMeta.class.name} referenced in ${expanderClass.name} via @UseExpansionMethod for field "${linkMeta.name}" is not registered or decorated with @ExpanderMethods.` // Use linkMeta.name
            )
          }
          // Further validation to check if the 'method' exists on the reusable instance
          const reusableInstance = this.expanderMethodsInstances.get(linkMeta.class)?.instance
          if (!reusableInstance || typeof reusableInstance[linkMeta.method] !== 'function') {
            throw new Error(
              `Method "${String(linkMeta.method)}" referenced in ${
                expanderClass.name
              } via @UseExpansionMethod for field "${linkMeta.name}" does not exist on class ${
                linkMeta.class.name
              } decorated with @ExpanderMethods.`
            )
          }
        })
      })

      if (this.conf?.enableLogging) {
        this.logger.log('Expansion logging is enabled.')
        this.log('debug', `Discovered ${this.standardExpanders.size} standard expander DTOs.`)
        this.log('debug', `Discovered ${this.expanderMethodsInstances.size} classes decorated with @ExpanderMethods.`)
        this.log('debug', `Discovered ${this.expansionMethodLinks.size} expander classes using @UseExpansionMethod.`)
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
    const expansionThree = createExpansionThree(expands)
    const selectionThree = createExpansionThree(selects)

    const response =
      expands && expandable
        ? await this.expandResource(request, resource, expandable, expansionThree, expansionErrors)
        : resource

    const result =
      selects && (selectable || this.config.enableGlobalSelection)
        ? this.selectResource(response, selectable, selectionThree)
        : response

    // If we have errors and error inclusion is enabled, add them to the response
    handleExpansionErrors(
      expansionErrors,
      expandable?.rootField ? result[expandable.rootField] : result,
      this.config.errorHandling?.includeErrorsInResponse
    )

    return result as T
  }

  private log(level: 'debug' | 'log' | 'warn' | 'error', message: string, ...optionalParams: any[]): void {
    if (!this.conf.logLevel || this.conf.logLevel === 'none') return

    // Only log if the configured log level is high enough
    const levels = ['debug', 'log', 'warn', 'error']
    if (levels.indexOf(this.conf.logLevel) <= levels.indexOf(level)) {
      this.logger[level](message, ...optionalParams)
    }
  }

  /**
   * Helper to discover @UseExpansionMethod metadata on a class.
   * @param targetClass The class to inspect for @UseExpansionMethod metadata.
   * @returns A map of field names to their corresponding UseExpansionMethodMetadata.
   */
  private discoverExpansionMethodLinks(targetClass: Type<any>): ExpanderMethodLinks {
    const links = new Map<string, UseExpansionMethodMetadata>()
    // Use Reflect.getMetadata to retrieve the array stored by the decorator
    const metadataList =
      (Reflect.getMetadata(USE_EXPANSION_METHOD_KEY, targetClass) as UseExpansionMethodMetadata[] | undefined) || []

    // Iterate through the array of configurations
    metadataList.forEach((meta) => {
      if (meta && meta.name) {
        // Check if meta is valid and has the 'name' property
        if (links.has(meta.name)) {
          this.log(
            'warn',
            `Duplicate @UseExpansionMethod configuration found for field "${meta.name}" on class ${targetClass.name}. The last one defined will be used.`
          )
        }
        links.set(meta.name, meta) // Store the whole config object, keyed by field name
      }
    })
    return links
  }

  /**
   * Returns the @Expandable metadata for a given method using the Reflect API.
   * @remarks
   * This method is used internally as a wrapper around Reflect.getMetadata to make testing easier.
   * @param target - The method to be inspected.
   * @returns The @Expandable metadata for the given method or undefined if none is found.
   */
  private getMethodExpandableMetadata(target: Function): ExpandableParams | undefined {
    return Reflect.getMetadata(EXPANDABLE_KEY, target)
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
    expandableParams: ExpandableParams,
    three: ExpansionThree,
    expansionErrors: Map<string, ExpansionError>
  ): Promise<any> {
    // Get the DTO class constructor from the expandable parameters
    const dtoClass = expandableParams.target
    if (!dtoClass) {
      this.log('warn', `NestJsExpand: @Expandable decorator is missing target DTO class.`)
      return resource
    }

    // Find standard expander instances for this DTO
    const standardExpanderInstances = this.standardExpanders.get(dtoClass)

    // Find linked reusable methods for this DTO
    const linkedMethods: ExpanderMethodLinks = new Map()
    standardExpanderInstances?.forEach((instance) => {
      const instanceLinks = this.expansionMethodLinks.get(instance.constructor)
      if (instanceLinks) {
        for (const [fieldName, metadata] of instanceLinks.entries()) {
          linkedMethods.set(fieldName, metadata)
        }
      }
    })

    if (!standardExpanderInstances && !linkedMethods.size) {
      this.log('warn', `NestJsExpand: No standard expanders or linked reusable methods found for DTO ${dtoClass.name}.`)
      return resource
    }

    return this.transformResource(resource, expandableParams, async (parent: any, index?: number) => {
      if (!parent) return parent

      const extraValues: Record<string, unknown> = {}
      const context: ExpandContext = { parent, request } // Create context once

      for (const propName in three) {
        if (!three[propName]) continue // Skip if expansion is explicitly false

        let value: any
        const expansionPath =
          typeof index === 'number' ? `${dtoClass.name}.${propName}[${index}]` : `${dtoClass.name}.${propName}`

        // Get errror policy from the expandable parameters or use default
        const errorPolicy = expandableParams.errorPolicy || this.conf.errorHandling?.defaultErrorPolicy || 'ignore'

        try {
          let standardExpanderInstance: Record<string, StandardExpandMethod> | undefined
          let expanderMethodsInstanceInfo: DiscoveredExpanderMethods | undefined

          // --- Check for @UseExpansionMethod link first ---
          const linkMetadata = linkedMethods?.get(propName)
          if (linkMetadata) {
            this.log('debug', `Using @UseExpansionMethod for ${expansionPath}`)
            expanderMethodsInstanceInfo = this.expanderMethodsInstances.get(linkMetadata.class)
            if (!expanderMethodsInstanceInfo?.instance) {
              throw new Error(
                `Internal Error: Instance for ${linkMetadata.class.name} decorated with @ExpanderMethods not found.`
              )
            }

            const reusableInstance = expanderMethodsInstanceInfo.instance
            const reusableMethod = reusableInstance[linkMetadata.method] as ReusableExpandMethod
            if (typeof reusableMethod !== 'function') {
              throw new Error(
                `Internal Error: Method "${String(linkMetadata.method)}" not found on class ${
                  linkMetadata.class.name
                } decorated with @ExpanderMethods.`
              )
            }

            // Determine arguments based on params config
            let args: any[]
            if (Array.isArray(linkMetadata.params)) {
              // Simple property path array
              args = linkMetadata.params.map((propPath) => {
                // Basic property access, could be extended for deep paths
                const propValue = parent[propPath]
                if (propValue === undefined || propValue === null) {
                  this.log(
                    'debug',
                    `Skipping expansion for ${expansionPath} via ${linkMetadata.class.name}.${String(
                      linkMetadata.method
                    )} due to missing parent property: ${String(propPath)}`
                  )
                  // Throw an error that can be caught below to handle policies like 'ignore' gracefully
                  throw new Error(`Missing required parent property "${String(propPath)}" for reusable expansion.`)
                }
                return propValue
              })
            } else if (typeof linkMetadata.params === 'function') {
              // Custom params function
              args = linkMetadata.params(context)
            } else {
              throw new Error(
                `Invalid 'params' configuration for ${expansionPath} using ${linkMetadata.class.name}.${String(
                  linkMetadata.method
                )}.`
              )
            }

            value = await reusableMethod.apply(reusableInstance, args)
          } else {
            // --- Fallback to standard @Expander method ---
            standardExpanderInstance = standardExpanderInstances?.find((e) => propName in e)
            if (standardExpanderInstance) {
              this.log('debug', `Using standard @Expander method for ${expansionPath}`)
              const standardMethod = standardExpanderInstance[propName] as StandardExpandMethod
              value = await standardMethod.call(standardExpanderInstance, context)
            } else {
              this.log(
                'warn',
                `NestJsExpand: No expander method (standard or linked reusable) found for requested expansion "${propName}" on DTO ${dtoClass.name}.`
              )
              continue // Skip this property if no method found
            }
          }

          // --- Recursive Expansion & Error Handling (Common Logic) ---
          const subThree = three[propName]
          if (value && typeof subThree === 'object') {
            // Determine if the *executed* method (standard or reusable) is decorated with @Expandable
            const methodToInspect = linkMetadata
              ? expanderMethodsInstanceInfo!.instance[linkMetadata.method] // The reusable method
              : standardExpanderInstance![propName] // The standard method

            const recursiveParams = this.getMethodExpandableMetadata(methodToInspect)
            if (recursiveParams) {
              value = await this.expandResource(request, value, recursiveParams, subThree, expansionErrors)
            } else {
              this.log(
                'warn',
                `NestJsExpand: Missing @Expandable on method for ${propName} to recursively expand ${Object.keys(
                  subThree
                )}. Target DTO: ${dtoClass.name}`
              )
            }
          }
          extraValues[propName] = value
        } catch (error: any) {
          // Handle errors based on policy (common logic for both paths)
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
            throw error // Re-throw to interrupt the request via interceptor
          }
          // For 'ignore' or 'include', log and continue to the next property
          this.log('warn', `Error during expansion of ${expansionPath}: ${error.message}`, error.stack)
          continue
        }
      }

      return { ...parent, ...extraValues }
    })
  }

  private selectResource(resource: any, selectable: SelectableParams | undefined, three: ExpansionThree) {
    // Check if selection is empty; if so, return resource as is.
    if (Object.keys(three).length === 0) {
      return resource
    }
    return this.transformResource(resource, selectable, (parent) => {
      if (!parent) return parent
      return maskObjectWithThree(parent, three)
    })
  }
}
