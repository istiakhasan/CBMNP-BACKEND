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
        next: (response) => {
          const moduleName = this.getModuleName(path);
          const action = this.getActionName(method, path);
          const actor =
            request.user?.name ||
            request.body?.userName ||
            request.user?.userId ||
            request.user?.id ||
            request.body?.userId ||
            'System';
          const target = this.getTargetLabel(request, response);

          void this.activityLogService.recordActivity({
            organizationId: request.headers['x-organization-id'],
            userId: request.user?.userId || request.user?.id || request.body?.userId,
            userName: request.user?.name || request.body?.userName,
            module: this.toTitle(moduleName),
            action,
            method,
            path,
            description: `${actor} ${action.toLowerCase()} ${this.toTitle(moduleName)}${target ? ` (${target})` : ''}`,
            metadata: {
              activity: {
                actor,
                action,
                module: this.toTitle(moduleName),
                target,
              },
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

  private getActionName(method: string, path: string): string {
    const cleanPath = (path || '').toLowerCase();

    if (cleanPath.includes('change-status')) return 'Changed status';
    if (cleanPath.includes('delete-by-phone')) return 'Deleted selected order';
    if (cleanPath.includes('approve')) return 'Approved';
    if (cleanPath.includes('cancel')) return 'Cancelled';
    if (cleanPath.includes('dispatch')) return 'Dispatched';
    if (cleanPath.includes('receive')) return 'Received';
    if (cleanPath.includes('return')) return 'Returned';
    if (cleanPath.includes('void')) return 'Voided';
    if (cleanPath.includes('login')) return 'Logged in';

    const actionByMethod: Record<string, string> = {
      POST: 'Created',
      PUT: 'Updated',
      PATCH: 'Updated',
      DELETE: 'Deleted',
    };

    return actionByMethod[method] || 'Changed';
  }

  private getTargetLabel(request: any, response: any): string {
    const params = request.params || {};
    const body = request.body || {};
    const data = response?.data || response;

    const value =
      params.id ||
      params.orderId ||
      params.userId ||
      body.orderId ||
      body.id ||
      body.phone ||
      data?.id ||
      data?.orderId ||
      data?.invoice ||
      data?.name ||
      data?.phone;

    if (!value) return '';
    return String(value);
  }

  private toTitle(value: string): string {
    return (value || 'system')
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
