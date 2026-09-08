import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { AttendancePeriod } from '../../attendance/models/attendance-period.model';
import { User } from '../../auth/models/user.model';
import { PayrollPeriodStatus } from '@blue-royal/contracts';

export class PayrollPeriod extends BaseModel {
  declare public periodCode: string;
  declare public name: string;
  declare public startDate: string;
  declare public endDate: string;
  declare public attendancePeriodId: string;
  declare public status: PayrollPeriodStatus;
  declare public totalGrossPay: number;
  declare public totalDeductions: number;
  declare public totalNetPay: number;
  declare public employeeCount: number;
  declare public blockingIssuesCount: number;
  declare public calculatedBy: string | null;
  declare public calculatedAt: Date | null;
  declare public reviewedBy: string | null;
  declare public reviewedAt: Date | null;
  declare public finalizedBy: string | null;
  declare public finalizedAt: Date | null;
  declare public unlockReason: string | null;
  declare public unlockedBy: string | null;
  declare public unlockedAt: Date | null;

  declare public attendancePeriod?: AttendancePeriod;
  declare public calculatedByUser?: User;
  declare public reviewedByUser?: User;
  declare public finalizedByUser?: User;
}

PayrollPeriod.init(
  {
    ...baseModelAttributes,
    periodCode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      field: 'period_code',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'start_date',
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'end_date',
    },
    attendancePeriodId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'attendance_period_id',
      references: {
        model: 'attendance_periods',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
    },
    totalGrossPay: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'total_gross_pay',
      get() {
        const val = this.getDataValue('totalGrossPay');
        return val === null ? 0 : Number(val);
      },
    },
    totalDeductions: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'total_deductions',
      get() {
        const val = this.getDataValue('totalDeductions');
        return val === null ? 0 : Number(val);
      },
    },
    totalNetPay: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'total_net_pay',
      get() {
        const val = this.getDataValue('totalNetPay');
        return val === null ? 0 : Number(val);
      },
    },
    employeeCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'employee_count',
    },
    blockingIssuesCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'blocking_issues_count',
    },
    calculatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'calculated_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    calculatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'calculated_at',
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reviewed_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
    finalizedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'finalized_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    finalizedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'finalized_at',
    },
    unlockReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'unlock_reason',
    },
    unlockedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'unlocked_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    unlockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'unlocked_at',
    },
  },
  {
    sequelize,
    tableName: 'payroll_periods',
    timestamps: true,
    underscored: true,
  },
);

PayrollPeriod.belongsTo(AttendancePeriod, { foreignKey: 'attendance_period_id', as: 'attendancePeriod' });
PayrollPeriod.belongsTo(User, { foreignKey: 'calculated_by', as: 'calculatedByUser' });
PayrollPeriod.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewedByUser' });
PayrollPeriod.belongsTo(User, { foreignKey: 'finalized_by', as: 'finalizedByUser' });
