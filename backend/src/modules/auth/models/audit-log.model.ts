import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class AuditLog extends BaseModel {
  declare public actorId: string | null;
  declare public actorIp: string | null;
  declare public actorUserAgent: string | null;
  declare public action: string;
  declare public resourceType: string;
  declare public resourceId: string | null;
  declare public oldValues: Record<string, any> | null;
  declare public newValues: Record<string, any> | null;
  declare public correlationId: string | null;
}

AuditLog.init(
  {
    ...baseModelAttributes,
    actorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'actor_id',
    },
    actorIp: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'actor_ip',
    },
    actorUserAgent: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'actor_user_agent',
    },
    action: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    resourceType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'resource_type',
    },
    resourceId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'resource_id',
    },
    oldValues: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'old_values',
    },
    newValues: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'new_values',
    },
    correlationId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'correlation_id',
    },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false, // immutable append-only table
    underscored: true,
  },
);
