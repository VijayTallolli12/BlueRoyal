import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class Designation extends BaseModel {
  declare public code: string;
  declare public title: string;
  declare public description: string | null;
  declare public isActive: boolean;
}

Designation.init(
  {
    ...baseModelAttributes,
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    sequelize,
    tableName: 'designations',
    timestamps: true,
    underscored: true,
  },
);
