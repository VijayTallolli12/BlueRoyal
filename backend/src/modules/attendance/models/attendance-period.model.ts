import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { User } from '../../auth/models/user.model';

export type AttendancePeriodStatus = 'draft' | 'submitted' | 'approved' | 'locked';

export class AttendancePeriod extends BaseModel {
  declare public periodCode: string;
  declare public name: string;
  declare public startDate: string;
  declare public endDate: string;
  declare public status: AttendancePeriodStatus;
  declare public submittedBy: string | null;
  declare public submittedAt: Date | null;
  declare public approvedBy: string | null;
  declare public approvedAt: Date | null;
  declare public lockedBy: string | null;
  declare public lockedAt: Date | null;
  declare public unlockedBy: string | null;
  declare public unlockedAt: Date | null;
  declare public unlockReason: string | null;

  declare public submitter?: User;
  declare public approver?: User;
  declare public locker?: User;
  declare public unlocker?: User;
}

AttendancePeriod.init(
  {
    ...baseModelAttributes,
    periodCode: {
      type: DataTypes.STRING(7),
      allowNull: false,
      unique: true,
      field: 'period_code',
    },
    name: {
      type: DataTypes.STRING(64),
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
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
    },
    submittedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'submitted_by',
      references: { model: 'users', key: 'id' },
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'submitted_at',
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
    lockedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'locked_by',
      references: { model: 'users', key: 'id' },
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'locked_at',
    },
    unlockedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'unlocked_by',
      references: { model: 'users', key: 'id' },
    },
    unlockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'unlocked_at',
    },
    unlockReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'unlock_reason',
    },
  },
  {
    sequelize,
    tableName: 'attendance_periods',
    timestamps: true,
    underscored: true,
  },
);

AttendancePeriod.belongsTo(User, { foreignKey: 'submitted_by', as: 'submitter' });
AttendancePeriod.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
AttendancePeriod.belongsTo(User, { foreignKey: 'locked_by', as: 'locker' });
AttendancePeriod.belongsTo(User, { foreignKey: 'unlocked_by', as: 'unlocker' });
