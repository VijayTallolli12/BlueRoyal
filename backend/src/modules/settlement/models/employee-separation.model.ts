import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from '../../masters/models/employee.model';
import { User } from '../../auth/models/user.model';
import { SeparationType, SeparationStatus, ClearanceStatus, ClearanceDetails } from '@blue-royal/contracts';

export class EmployeeSeparation extends BaseModel {
  declare public employeeId: string;
  declare public separationType: SeparationType;
  declare public noticeDate: string;
  declare public lastWorkingDay: string;
  declare public contractualNoticeDays: number;
  declare public actualNoticeDays: number;
  declare public reason: string | null;
  declare public repatriationRequired: boolean;
  declare public destinationCountry: string | null;
  declare public hasNewUaeEmployment: boolean;
  declare public clearanceStatus: ClearanceStatus;
  declare public clearanceDetails: ClearanceDetails;
  declare public status: SeparationStatus;
  declare public createdBy: string | null;

  declare public employee?: Employee;
  declare public creator?: User;
}

EmployeeSeparation.init(
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
    separationType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'separation_type',
    },
    noticeDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'notice_date',
    },
    lastWorkingDay: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'last_working_day',
    },
    contractualNoticeDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      field: 'contractual_notice_days',
    },
    actualNoticeDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      field: 'actual_notice_days',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    repatriationRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'repatriation_required',
    },
    destinationCountry: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'destination_country',
    },
    hasNewUaeEmployment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'has_new_uae_employment',
    },
    clearanceStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
      field: 'clearance_status',
    },
    clearanceDetails: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        itAssetsReturned: false,
        accessCardsReturned: false,
        loansReconciled: false,
        visaCancellationInitiated: false,
      },
      field: 'clearance_details',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'employee_separations',
    timestamps: true,
    underscored: true,
  },
);

EmployeeSeparation.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Employee.hasMany(EmployeeSeparation, { foreignKey: 'employee_id', as: 'separations' });

EmployeeSeparation.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
