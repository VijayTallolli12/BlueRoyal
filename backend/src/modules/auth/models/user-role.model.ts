import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';

export class UserRole extends Model {
  declare public userId: string;
  declare public roleId: string;
  declare public createdAt: Date;
}

UserRole.init(
  {
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: 'user_id',
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: 'role_id',
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
    tableName: 'user_roles',
    timestamps: false,
    underscored: true,
  },
);
