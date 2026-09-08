import { Transaction } from 'sequelize';
import { AuditLog } from '../../modules/auth/models/audit-log.model';
import { logger } from '../logger/logger';

export interface AuditEventParams {
  actorId?: string | null;
  actorIp?: string | null;
  actorUserAgent?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  correlationId?: string | null;
  transaction?: Transaction;
}

export class AuditService {
  public static async recordEvent(params: AuditEventParams): Promise<AuditLog | null> {
    try {
      return await AuditLog.create(
        {
          actorId: params.actorId || null,
          actorIp: params.actorIp || null,
          actorUserAgent: params.actorUserAgent || null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId || null,
          oldValues: params.oldValues || null,
          newValues: params.newValues || null,
          correlationId: params.correlationId || null,
        } as any,
        params.transaction ? { transaction: params.transaction } : undefined,
      );
    } catch (error) {
      // Never let an audit logging failure crash the primary business transaction, but log error loudly
      logger.error('Failed to write audit log entry:', { error, params });
      return null;
    }
  }
}
