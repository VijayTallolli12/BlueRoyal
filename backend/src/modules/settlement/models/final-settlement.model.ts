import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from '../../masters/models/employee.model';
import { EmployeeSeparation } from './employee-separation.model';
import { User } from '../../auth/models/user.model';
import { SettlementStatus } from '@blue-royal/contracts';

export class FinalSettlement extends BaseModel {
  declare public settlementCode: string;
  declare public separationId: string;
  declare public employeeId: string;
  declare public serviceStartDate: string;
  declare public lastWorkingDay: string;
  declare public totalServiceCalendarDays: number;
  declare public unpaidLeaveDays: number;
  declare public netServiceDays: number;
  declare public serviceYears: number;
  declare public remunerationBasis: 'hourly' | 'salaried';
  declare public lastBasicSalary: number;
  declare public dailyBasicWage: number;
  declare public dailyGrossWage: number | null;
  declare public gratuityAmount: number;
  declare public gratuityWithheld: boolean;
  declare public gratuityWithholdReason: string | null;
  declare public leaveBalanceDays: number;
  declare public leaveSalaryAmount: number;
  declare public airTicketAmount: number;
  declare public finalWagesAmount: number;
  declare public noticeShortfallAmount: number;
  declare public grossAdditions: number;
  declare public totalDeductions: number;
  declare public netSettlementAmount: number;
  declare public status: SettlementStatus;
  declare public reviewedBy: string | null;
  declare public reviewedAt: Date | null;
  declare public approvedBy: string | null;
  declare public approvedAt: Date | null;
  declare public finalizedBy: string | null;
  declare public finalizedAt: Date | null;
  declare public notes: string | null;

  declare public employee?: Employee;
  declare public separation?: EmployeeSeparation;
  declare public reviewer?: User;
  declare public approver?: User;
  declare public finalizer?: User;
  declare public lines?: any[];
}

FinalSettlement.init(
  {
    ...baseModelAttributes,
    settlementCode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      field: 'settlement_code',
    },
    separationId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'separation_id',
      references: {
        model: 'employee_separations',
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
    serviceStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'service_start_date',
    },
    lastWorkingDay: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'last_working_day',
    },
    totalServiceCalendarDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'total_service_calendar_days',
    },
    unpaidLeaveDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'unpaid_leave_days',
    },
    netServiceDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'net_service_days',
    },
    serviceYears: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      field: 'service_years',
      get(): number {
        const val = this.getDataValue('serviceYears');
        return val !== null ? Number(val) : 0;
      },
    },
    remunerationBasis: {
      type: DataTypes.STRING(16),
      allowNull: false,
      field: 'remuneration_basis',
    },
    lastBasicSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'last_basic_salary',
      get(): number {
        const val = this.getDataValue('lastBasicSalary');
        return val !== null ? Number(val) : 0;
      },
    },
    dailyBasicWage: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'daily_basic_wage',
      get(): number {
        const val = this.getDataValue('dailyBasicWage');
        return val !== null ? Number(val) : 0;
      },
    },
    dailyGrossWage: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'daily_gross_wage',
      get(): number | null {
        const val = this.getDataValue('dailyGrossWage');
        return val !== null && val !== undefined ? Number(val) : null;
      },
    },
    gratuityAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'gratuity_amount',
      get(): number {
        const val = this.getDataValue('gratuityAmount');
        return val !== null ? Number(val) : 0;
      },
    },
    gratuityWithheld: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'gratuity_withheld',
    },
    gratuityWithholdReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'gratuity_withhold_reason',
    },
    leaveBalanceDays: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'leave_balance_days',
      get(): number {
        const val = this.getDataValue('leaveBalanceDays');
        return val !== null ? Number(val) : 0;
      },
    },
    leaveSalaryAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'leave_salary_amount',
      get(): number {
        const val = this.getDataValue('leaveSalaryAmount');
        return val !== null ? Number(val) : 0;
      },
    },
    airTicketAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'air_ticket_amount',
      get(): number {
        const val = this.getDataValue('airTicketAmount');
        return val !== null ? Number(val) : 0;
      },
    },
    finalWagesAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'final_wages_amount',
      get(): number {
        const val = this.getDataValue('finalWagesAmount');
        return val !== null ? Number(val) : 0;
      },
    },
    noticeShortfallAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'notice_shortfall_amount',
      get(): number {
        const val = this.getDataValue('noticeShortfallAmount');
        return val !== null ? Number(val) : 0;
      },
    },
    grossAdditions: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'gross_additions',
      get(): number {
        const val = this.getDataValue('grossAdditions');
        return val !== null ? Number(val) : 0;
      },
    },
    totalDeductions: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'total_deductions',
      get(): number {
        const val = this.getDataValue('totalDeductions');
        return val !== null ? Number(val) : 0;
      },
    },
    netSettlementAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'net_settlement_amount',
      get(): number {
        const val = this.getDataValue('netSettlementAmount');
        return val !== null ? Number(val) : 0;
      },
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reviewed_by',
      references: { model: 'users', key: 'id' },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'approved_by',
      references: { model: 'users', key: 'id' },
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'approved_at',
    },
    finalizedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'finalized_by',
      references: { model: 'users', key: 'id' },
    },
    finalizedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'finalized_at',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'final_settlements',
    timestamps: true,
    underscored: true,
  },
);

FinalSettlement.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
FinalSettlement.belongsTo(EmployeeSeparation, { foreignKey: 'separation_id', as: 'separation' });
EmployeeSeparation.hasOne(FinalSettlement, { foreignKey: 'separation_id', as: 'settlement' });

FinalSettlement.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });
FinalSettlement.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
FinalSettlement.belongsTo(User, { foreignKey: 'finalized_by', as: 'finalizer' });
