import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';

export class RolePermission extends Model {
  declare public roleId: string;
  declare public permissionId: string;
  declare public createdAt: Date;
}

RolePermission.init(
  {
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: 'role_id',
    },
    permissionId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: 'permission_id',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'role_permissions',
    timestamps: false,
    underscored: true,
  },
);
