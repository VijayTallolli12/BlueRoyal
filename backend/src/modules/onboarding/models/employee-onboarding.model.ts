import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from '../../masters/models/employee.model';
import { User } from '../../auth/models/user.model';
import { OnboardingChecklist } from '@blue-royal/contracts';

export class EmployeeOnboarding extends BaseModel {
  declare public employeeId: string;
  declare public status: 'draft' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  declare public currentStep: string;
  declare public completionPercentage: number;
  declare public checklistProgress: OnboardingChecklist;
  declare public targetStartDate: string | null;
  declare public completedAt: Date | null;
  declare public completedByUserId: string | null;
  declare public notes: string | null;

  declare public employee?: Employee;
  declare public completer?: User;
}

EmployeeOnboarding.init(
  {
    ...baseModelAttributes,
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'employee_id',
      references: {
        model: 'employees',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
    },
    currentStep: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'personal_info',
      field: 'current_step',
    },
    completionPercentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'completion_percentage',
    },
    checklistProgress: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        personalInfo: false,
        employmentDetails: false,
        assignmentSetup: false,
        compensationSetup: false,
        mandatoryDocuments: false,
      },
      field: 'checklist_progress',
    },
    targetStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'target_start_date',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
    completedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'completed_by_user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'employee_onboardings',
    timestamps: true,
    underscored: true,
  },
);

EmployeeOnboarding.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Employee.hasOne(EmployeeOnboarding, { foreignKey: 'employee_id', as: 'onboarding' });

EmployeeOnboarding.belongsTo(User, { foreignKey: 'completed_by_user_id', as: 'completer' });
