import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { PayrollPeriod } from './payroll-period.model';
import { Employee } from '../../masters/models/employee.model';
import { Designation } from '../../masters/models/designation.model';
import { RemunerationBasis } from '@blue-royal/contracts';

export class PayrollItem extends BaseModel {
  declare public payrollPeriodId: string;
  declare public employeeId: string;
  declare public remunerationBasis: RemunerationBasis;
  declare public designationId: string | null;
  declare public daysInPeriod: number;
  declare public totalActualHours: number;
  declare public totalRegularHours: number;
  declare public totalOtHours: number;
  declare public totalAbsenceDays: number;
  declare public totalLeaveDays: number;
  declare public grossPay: number;
  declare public totalDeductions: number;
  declare public netPay: number;
  declare public hasBlockingIssue: boolean;
  declare public blockingReason: string | null;

  declare public payrollPeriod?: PayrollPeriod;
  declare public employee?: Employee;
  declare public designation?: Designation;
  declare public lines?: any[];
}

PayrollItem.init(
  {
    ...baseModelAttributes,
    payrollPeriodId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'payroll_period_id',
      references: {
        model: 'payroll_periods',
        key: 'id',
      },
    },
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'employee_id',
      references: {
        model: 'employees',
        key: 'id',
      },
    },
    remunerationBasis: {
      type: DataTypes.STRING(16),
      allowNull: false,
      field: 'remuneration_basis',
    },
    designationId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'designation_id',
      references: {
        model: 'designations',
        key: 'id',
      },
    },
    daysInPeriod: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'days_in_period',
    },
    totalActualHours: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'total_actual_hours',
      get() {
        const val = this.getDataValue('totalActualHours');
        return val === null ? 0 : Number(val);
      },
    },
    totalRegularHours: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'total_regular_hours',
      get() {
        const val = this.getDataValue('totalRegularHours');
        return val === null ? 0 : Number(val);
      },
    },
    totalOtHours: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'total_ot_hours',
      get() {
        const val = this.getDataValue('totalOtHours');
        return val === null ? 0 : Number(val);
      },
    },
    totalAbsenceDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_absence_days',
    },
    totalLeaveDays: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'total_leave_days',
      get() {
        const val = this.getDataValue('totalLeaveDays');
        return val === null ? 0 : Number(val);
      },
    },
    grossPay: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'gross_pay',
      get() {
        const val = this.getDataValue('grossPay');
        return val === null ? 0 : Number(val);
      },
    },
    totalDeductions: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'total_deductions',
      get() {
        const val = this.getDataValue('totalDeductions');
        return val === null ? 0 : Number(val);
      },
    },
    netPay: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'net_pay',
      get() {
        const val = this.getDataValue('netPay');
        return val === null ? 0 : Number(val);
      },
    },
    hasBlockingIssue: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'has_blocking_issue',
    },
    blockingReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'blocking_reason',
    },
  },
  {
    sequelize,
    tableName: 'payroll_items',
    timestamps: true,
    underscored: true,
  },
);

PayrollItem.belongsTo(PayrollPeriod, { foreignKey: 'payroll_period_id', as: 'payrollPeriod' });
PayrollItem.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
PayrollItem.belongsTo(Designation, { foreignKey: 'designation_id', as: 'designation' });
PayrollPeriod.hasMany(PayrollItem, { foreignKey: 'payroll_period_id', as: 'items' });
