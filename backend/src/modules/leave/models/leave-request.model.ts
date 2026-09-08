import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from '../../masters/models/employee.model';
import { LeaveType } from './leave-type.model';
import { User } from '../../auth/models/user.model';
import { LeaveRequestStatus } from '@blue-royal/contracts';

export class LeaveRequest extends BaseModel {
  declare public requestNumber: string;
  declare public employeeId: string;
  declare public leaveTypeId: string;
  declare public startDate: string;
  declare public endDate: string;
  declare public totalDays: number;
  declare public reason: string;
  declare public status: LeaveRequestStatus;
  declare public approvedBy: string | null;
  declare public approvedAt: Date | null;
  declare public rejectedBy: string | null;
  declare public rejectedAt: Date | null;
  declare public rejectionReason: string | null;
  declare public cancelledBy: string | null;
  declare public cancelledAt: Date | null;
  declare public cancellationReason: string | null;
  declare public attachmentUrl: string | null;

  declare public employee?: Employee;
  declare public leaveType?: LeaveType;
  declare public approver?: User;
  declare public rejector?: User;
  declare public canceller?: User;
}

LeaveRequest.init(
  {
    ...baseModelAttributes,
    requestNumber: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      field: 'request_number',
    },
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
    totalDays: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      field: 'total_days',
      get(): number {
        const val = this.getDataValue('totalDays');
        return val ? Number(val) : 0;
      },
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'reason',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'PENDING',
      field: 'status',
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
    rejectedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'rejected_by',
      references: { model: 'users', key: 'id' },
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'rejected_at',
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason',
    },
    cancelledBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'cancelled_by',
      references: { model: 'users', key: 'id' },
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'cancelled_at',
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'cancellation_reason',
    },
    attachmentUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'attachment_url',
    },
  },
  {
    sequelize,
    tableName: 'leave_requests',
    underscored: true,
  },
);

LeaveRequest.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
LeaveRequest.belongsTo(LeaveType, { foreignKey: 'leaveTypeId', as: 'leaveType' });
LeaveRequest.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });
LeaveRequest.belongsTo(User, { foreignKey: 'rejectedBy', as: 'rejector' });
LeaveRequest.belongsTo(User, { foreignKey: 'cancelledBy', as: 'canceller' });
