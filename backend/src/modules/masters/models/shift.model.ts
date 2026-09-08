import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class Shift extends BaseModel {
  declare public code: string;
  declare public name: string;
  declare public startTime: string;
  declare public endTime: string;
  declare public breakMinutes: number;
  declare public workHours: number;
  declare public isNightShift: boolean;
  declare public isActive: boolean;
}

Shift.init(
  {
    ...baseModelAttributes,
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    startTime: {
      type: DataTypes.TIME,
      allowNull: false,
      field: 'start_time',
    },
    endTime: {
      type: DataTypes.TIME,
      allowNull: false,
      field: 'end_time',
    },
    breakMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60,
      field: 'break_minutes',
    },
    workHours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      field: 'work_hours',
    },
    isNightShift: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_night_shift',
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
    tableName: 'shifts',
    timestamps: true,
    underscored: true,
  },
);
