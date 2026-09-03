import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ActivityLogService } from '../activity-log.service';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_KEYS = new Set([
  'password',
  'confirmPassword',
  'oldPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
]);

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly activityLogService: ActivityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const path = request.originalUrl || request.url;

    if (!MUTATION_METHODS.has(method) || this.shouldSkip(path)) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.activityLogService.recordActivity({
            organizationId: request.headers['x-organization-id'],
            userId: request.user?.userId || request.user?.id || request.body?.userId,
            userName: request.user?.name || request.body?.userName,
            module: this.getModuleName(path),
            action: method,
            method,
            path,
            description: `${method} ${path}`,
            metadata: {
              params: request.params || {},
              query: request.query || {},
              body: this.sanitize(request.body || {}),
              durationMs: Date.now() - startedAt,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            statusCode: request.res?.statusCode,
          });
        },
      }),
    );
  }

  private shouldSkip(path: string): boolean {
    return path?.includes('/v1/activity-logs') || path?.includes('/api/v1/images');
  }

  private getModuleName(path: string): string {
    const cleanPath = (path || '').split('?')[0];
    const parts = cleanPath.split('/').filter(Boolean);
    const v1Index = parts.findIndex((part) => part === 'v1');
    return parts[v1Index + 1] || parts[0] || 'system';
  }

  private sanitize(value: any): any {
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));
    if (!value || typeof value !== 'object') return value;

    return Object.entries(value).reduce((acc, [key, currentValue]) => {
      acc[key] = SENSITIVE_KEYS.has(key) ? '[FILTERED]' : this.sanitize(currentValue);
      return acc;
    }, {});
  }
}
