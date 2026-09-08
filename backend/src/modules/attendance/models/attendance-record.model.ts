import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { AttendancePeriod } from './attendance-period.model';
import { Employee } from '../../masters/models/employee.model';
import { Client } from '../../masters/models/client.model';
import { Project } from '../../masters/models/project.model';
import { Designation } from '../../masters/models/designation.model';
import { Shift } from '../../masters/models/shift.model';

export type DayType = 'regular_workday' | 'weekly_off' | 'public_holiday';

export class AttendanceRecord extends BaseModel {
  declare public attendancePeriodId: string;
  declare public employeeId: string;
  declare public workDate: string;
  declare public clientId: string | null;
  declare public projectId: string | null;
  declare public designationId: string | null;
  declare public shiftId: string | null;
  declare public dayType: DayType;
  declare public actualHours: number;
  declare public regularHours: number;
  declare public otHours: number;
  declare public isAbsent: boolean;
  declare public isOnLeave: boolean;
  declare public hasAnomaly: boolean;
  declare public anomalyReason: string | null;
  declare public remarks: string | null;

  declare public attendancePeriod?: AttendancePeriod;
  declare public employee?: Employee;
  declare public client?: Client;
  declare public project?: Project;
  declare public designation?: Designation;
  declare public shift?: Shift;
}

AttendanceRecord.init(
  {
    ...baseModelAttributes,
    attendancePeriodId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'attendance_period_id',
      references: { model: 'attendance_periods', key: 'id' },
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
    clientId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'client_id',
      references: { model: 'clients', key: 'id' },
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'project_id',
      references: { model: 'projects', key: 'id' },
    },
    designationId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'designation_id',
      references: { model: 'designations', key: 'id' },
    },
    shiftId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'shift_id',
      references: { model: 'shifts', key: 'id' },
    },
    dayType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'regular_workday',
      field: 'day_type',
    },
    actualHours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'actual_hours',
      get() {
        const val = this.getDataValue('actualHours');
        return val === null ? 0 : Number(val);
      },
    },
    regularHours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'regular_hours',
      get() {
        const val = this.getDataValue('regularHours');
        return val === null ? 0 : Number(val);
      },
    },
    otHours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: 'ot_hours',
      get() {
        const val = this.getDataValue('otHours');
        return val === null ? 0 : Number(val);
      },
    },
    isAbsent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_absent',
    },
    isOnLeave: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_on_leave',
    },
    hasAnomaly: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'has_anomaly',
    },
    anomalyReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'anomaly_reason',
    },
    remarks: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'attendance_records',
    timestamps: true,
    underscored: true,
  },
);

AttendanceRecord.belongsTo(AttendancePeriod, { foreignKey: 'attendance_period_id', as: 'attendancePeriod' });
AttendancePeriod.hasMany(AttendanceRecord, { foreignKey: 'attendance_period_id', as: 'records' });

AttendanceRecord.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
AttendanceRecord.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
AttendanceRecord.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
AttendanceRecord.belongsTo(Designation, { foreignKey: 'designation_id', as: 'designation' });
AttendanceRecord.belongsTo(Shift, { foreignKey: 'shift_id', as: 'shift' });
