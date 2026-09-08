import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from './employee.model';

export class SalaryComponent extends BaseModel {
  declare public code: string;
  declare public name: string;
  declare public type: 'earning' | 'deduction';
  declare public calculationType: 'fixed_amount' | 'percentage';
  declare public percentageBasisComponentId: string | null;
  declare public isRecurring: boolean;
  declare public isWpsBasic: boolean;
  declare public isWpsHousing: boolean;
  declare public isActive: boolean;

  declare public percentageBasisComponent?: SalaryComponent;
}

SalaryComponent.init(
  {
    ...baseModelAttributes,
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    calculationType: {
      type: DataTypes.STRING(16),
      allowNull: false,
      field: 'calculation_type',
    },
    percentageBasisComponentId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'percentage_basis_component_id',
      references: {
        model: 'salary_components',
        key: 'id',
      },
    },
    isRecurring: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_recurring',
    },
    isWpsBasic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_wps_basic',
    },
    isWpsHousing: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_wps_housing',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    sequelize,
    tableName: 'salary_components',
    timestamps: true,
    underscored: true,
  },
);

SalaryComponent.belongsTo(SalaryComponent, {
  foreignKey: 'percentage_basis_component_id',
  as: 'percentageBasisComponent',
});

export class EmployeeSalaryStructure extends BaseModel {
  declare public employeeId: string;
  declare public componentId: string;
  declare public amountOrPercentage: number;
  declare public effectiveFrom: string;
  declare public effectiveTo: string | null;

  declare public employee?: Employee;
  declare public component?: SalaryComponent;
}

EmployeeSalaryStructure.init(
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
    componentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'component_id',
      references: {
        model: 'salary_components',
        key: 'id',
      },
    },
    amountOrPercentage: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'amount_or_percentage',
    },
    effectiveFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'effective_from',
    },
    effectiveTo: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'effective_to',
    },
  },
  {
    sequelize,
    tableName: 'employee_salary_structures',
    timestamps: true,
    underscored: true,
  },
);

Employee.hasMany(EmployeeSalaryStructure, { foreignKey: 'employee_id', as: 'salaryStructures' });
EmployeeSalaryStructure.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

SalaryComponent.hasMany(EmployeeSalaryStructure, { foreignKey: 'component_id', as: 'salaryStructures' });
EmployeeSalaryStructure.belongsTo(SalaryComponent, { foreignKey: 'component_id', as: 'component' });
