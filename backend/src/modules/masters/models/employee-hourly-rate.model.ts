import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from './employee.model';

export class EmployeeHourlyRate extends BaseModel {
  declare public employeeId: string;
  declare public normalHourlyRate: number;
  declare public otHourlyRate: number;
  declare public effectiveFrom: string;
  declare public effectiveTo: string | null;
  declare public changeReason: string | null;

  declare public employee?: Employee;
}

EmployeeHourlyRate.init(
  {
    ...baseModelAttributes,
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'employee_id',
      references: {
        model: 'employees',
        key: 'id',
      },
    },
    normalHourlyRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'normal_hourly_rate',
    },
    otHourlyRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'ot_hourly_rate',
    },
    effectiveFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'effective_from',
    },
    effectiveTo: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'effective_to',
    },
    changeReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'change_reason',
    },
  },
  {
    sequelize,
    tableName: 'employee_hourly_rates',
    timestamps: true,
    underscored: true,
  },
);

Employee.hasMany(EmployeeHourlyRate, { foreignKey: 'employee_id', as: 'hourlyRates' });
EmployeeHourlyRate.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
