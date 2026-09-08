import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class LeaveType extends BaseModel {
  declare public code: string;
  declare public name: string;
  declare public description: string | null;
  declare public isPaid: boolean;
  declare public defaultDaysPerYear: number;
  declare public requiresAttachment: boolean;
  declare public deductWorkingDaysOnly: boolean;
  declare public allowDuringProbation: boolean;
  declare public isActive: boolean;
  declare public deletedAt: Date | null;
}

LeaveType.init(
  {
    ...baseModelAttributes,
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      field: 'code',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'name',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'description',
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_paid',
    },
    defaultDaysPerYear: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 30.0,
      field: 'default_days_per_year',
      get(): number {
        const val = this.getDataValue('defaultDaysPerYear');
        return val ? Number(val) : 0;
      },
    },
    requiresAttachment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'requires_attachment',
    },
    deductWorkingDaysOnly: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'deduct_working_days_only',
    },
    allowDuringProbation: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'allow_during_probation',
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
    tableName: 'leave_types',
    paranoid: true,
    underscored: true,
  },
);
