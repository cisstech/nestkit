// expand.interceptor.ts

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { EXPANDABLE_KEY, SELECTABLE_KEY } from './expand'
import { ExpandService } from './expand.service'

@Injectable()
export class ExpandInterceptor implements NestInterceptor {
  constructor(private readonly expandService: ExpandService) {}

  /**
   * Intercepts incoming requests and applies expansion based on metadata.
   * @param context - The execution context.
   * @param next - The next call handler.
   * @returns An observable with the expanded response.
   * @throws Error if there's an issue during the expansion process.
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
      return original.call(res, await this.expandService.expandAndSelect(req, body, expandable, selectable))
    }
    return next.handle()
  }
}
