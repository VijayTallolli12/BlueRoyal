import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class Permission extends BaseModel {
  declare public code: string;
  declare public description: string;
  declare public module: string;
}

Permission.init(
  {
    ...baseModelAttributes,
    code: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    module: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'permissions',
    timestamps: true,
    underscored: true,
  },
);
