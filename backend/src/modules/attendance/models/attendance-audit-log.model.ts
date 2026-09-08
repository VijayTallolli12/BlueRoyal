import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { AttendanceRecord } from './attendance-record.model';
import { Employee } from '../../masters/models/employee.model';
import { User } from '../../auth/models/user.model';

export class AttendanceAuditLog extends Model {
  declare public id: string;
  declare public attendanceRecordId: string;
  declare public employeeId: string;
  declare public workDate: string;
  declare public fieldName: string;
  declare public oldValue: string | null;
  declare public newValue: string | null;
  declare public changeReason: string;
  declare public actorId: string;
  declare public createdAt: Date;

  declare public record?: AttendanceRecord;
  declare public employee?: Employee;
  declare public actor?: User;
}

AttendanceAuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    attendanceRecordId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'attendance_record_id',
      references: { model: 'attendance_records', key: 'id' },
    },
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'employee_id',
      references: { model: 'employees', key: 'id' },
    },
    workDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'work_date',
    },
    fieldName: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'field_name',
    },
    oldValue: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'old_value',
    },
    newValue: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'new_value',
    },
    changeReason: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'change_reason',
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'actor_id',
      references: { model: 'users', key: 'id' },
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'attendance_audit_logs',
    timestamps: false,
    underscored: true,
  },
);

AttendanceAuditLog.belongsTo(AttendanceRecord, { foreignKey: 'attendance_record_id', as: 'record' });
AttendanceRecord.hasMany(AttendanceAuditLog, { foreignKey: 'attendance_record_id', as: 'auditLogs' });

AttendanceAuditLog.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
AttendanceAuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });
