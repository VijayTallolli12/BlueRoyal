import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { User } from '../../auth/models/user.model';

export class Employee extends BaseModel {
  declare public employeeCode: string;
  declare public userId: string | null;
  declare public firstName: string;
  declare public middleName: string | null;
  declare public lastName: string;
  declare public gender: string;
  declare public dateOfBirth: string;
  declare public nationality: string;
  declare public email: string | null;
  declare public phoneNumber: string | null;
  declare public dateOfJoining: string;
  declare public probationEndDate: string | null;
  declare public employmentType: 'full_time' | 'contract';
  declare public remunerationBasis: 'hourly' | 'salaried';
  declare public contractEndDate: string | null;
  declare public status: string;
  declare public deletedAt: Date | null;

  declare public user?: User;
}

Employee.init(
  {
    ...baseModelAttributes,
    employeeCode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      field: 'employee_code',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'first_name',
    },
    middleName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'middle_name',
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'last_name',
    },
    gender: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'date_of_birth',
    },
    nationality: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phoneNumber: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'phone_number',
    },
    dateOfJoining: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'date_of_joining',
    },
    probationEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'probation_end_date',
    },
    employmentType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'full_time',
      field: 'employment_type',
    },
    remunerationBasis: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'hourly',
      field: 'remuneration_basis',
    },
    contractEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'contract_end_date',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'probation',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    sequelize,
    tableName: 'employees',
    paranoid: true,
    timestamps: true,
    underscored: true,
  },
);

User.hasOne(Employee, { foreignKey: 'user_id', as: 'employee' });
Employee.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
