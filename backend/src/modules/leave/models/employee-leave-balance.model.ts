import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from '../../masters/models/employee.model';
import { LeaveType } from './leave-type.model';

export class EmployeeLeaveBalance extends BaseModel {
  declare public employeeId: string;
  declare public leaveTypeId: string;
  declare public year: number;
  declare public allocatedDays: number;
  declare public usedDays: number;
  declare public pendingDays: number;
  declare public carriedForward: number;
  declare public notes: string | null;

  declare public employee?: Employee;
  declare public leaveType?: LeaveType;

  public get remainingDays(): number {
    return Number(
      (
        Number(this.allocatedDays || 0) +
        Number(this.carriedForward || 0) -
        Number(this.usedDays || 0) -
        Number(this.pendingDays || 0)
      ).toFixed(2),
    );
  }
}

EmployeeLeaveBalance.init(
  {
    ...baseModelAttributes,
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'employee_id',
      references: { model: 'employees', key: 'id' },
    },
    leaveTypeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'leave_type_id',
      references: { model: 'leave_types', key: 'id' },
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'year',
    },
    allocatedDays: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'allocated_days',
      get(): number {
        const val = this.getDataValue('allocatedDays');
        return val ? Number(val) : 0;
      },
    },
    usedDays: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'used_days',
      get(): number {
        const val = this.getDataValue('usedDays');
        return val ? Number(val) : 0;
      },
    },
    pendingDays: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'pending_days',
      get(): number {
        const val = this.getDataValue('pendingDays');
        return val ? Number(val) : 0;
      },
    },
    carriedForward: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'carried_forward',
      get(): number {
        const val = this.getDataValue('carriedForward');
        return val ? Number(val) : 0;
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'notes',
    },
  },
  {
    sequelize,
    tableName: 'employee_leave_balances',
    underscored: true,
  },
);

EmployeeLeaveBalance.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
EmployeeLeaveBalance.belongsTo(LeaveType, { foreignKey: 'leaveTypeId', as: 'leaveType' });
