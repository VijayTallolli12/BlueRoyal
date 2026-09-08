import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class Role extends BaseModel {
  declare public name: string;
  declare public displayName: string;
  declare public description: string | null;
}

Role.init(
  {
    ...baseModelAttributes,
    name: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    displayName: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'display_name',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'roles',
    timestamps: true,
    underscored: true,
  },
);
