// expand.interceptor.ts

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { EXPANDABLE_KEY } from './expand'
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
    const expandable = Reflect.getMetadata(EXPANDABLE_KEY, context.getHandler())
    if (!expandable) return next.handle()

    const req = context.switchToHttp().getRequest()
    return next.handle().pipe(
      map(async (res) => {
        return this.expandService.expand(req, res, expandable)
      })
    )
  }
}
