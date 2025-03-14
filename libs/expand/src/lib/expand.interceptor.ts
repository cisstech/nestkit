// expand.interceptor.ts

import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { EXPANDABLE_KEY, SELECTABLE_KEY } from './expand'
import { ExpandService } from './expand.service'

@Injectable()
export class ExpandInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ExpandService.name)

  constructor(private readonly expandService: ExpandService) {}

  /**
   * Intercepts incoming requests and applies expansion based on metadata.
   * @param context - The execution context.
   * @param next - The next call handler.
   * @returns An observable with the expanded response.
   * @throws Error if there's an issue during the expansion process and the error policy is set to 'throw'.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()

    const expandable = Reflect.getMetadata(EXPANDABLE_KEY, context.getHandler())
    const selectable = Reflect.getMetadata(SELECTABLE_KEY, context.getHandler())

    if (!expandable && !selectable && !this.expandService.config.enableGlobalSelection) return next.handle()

    const http = context.switchToHttp()
    const req = http.getRequest()
    const res = http.getResponse()

    const original = res.json
    res.json = async (body: unknown) => {
      if (res.statusCode && res.statusCode >= 400) return original.call(res, body)

      try {
        const expanded = await this.expandService.expandAndSelect(req, body, expandable, selectable)
        return original.call(res, expanded)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        const config = this.expandService.config

        if (config.enableLogging) {
          // Use configured log level
          if (config.logLevel === 'error') {
            this.logger.error(`Error during expansion: ${error.message}`, error.stack)
          } else if (config.logLevel === 'warn') {
            this.logger.warn(`Error during expansion: ${error.message}`)
          } else if (config.logLevel === 'log') {
            this.logger.log(`Error during expansion: ${error.message}`)
          } else if (config.logLevel === 'debug') {
            this.logger.debug(`Error during expansion: ${error.message}`, error.stack)
          }
        }

        // If the endpoint-level or default policy is 'throw', we need to bubble up the error
        const errorPolicy = expandable?.errorPolicy || config.errorHandling?.defaultErrorPolicy || 'ignore'

        if (errorPolicy === 'throw') {
          throw error
        }

        return original.call(res, body)
      }
    }
    return next.handle()
  }
}
