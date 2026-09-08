import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Employee } from './employee.model';
import { Client } from './client.model';
import { Project } from './project.model';
import { Designation } from './designation.model';

export class EmployeeAssignment extends BaseModel {
  declare public employeeId: string;
  declare public clientId: string;
  declare public projectId: string;
  declare public designationId: string;
  declare public effectiveFrom: string;
  declare public effectiveTo: string | null;
  declare public remarks: string | null;

  declare public employee?: Employee;
  declare public client?: Client;
  declare public project?: Project;
  declare public designation?: Designation;
}

EmployeeAssignment.init(
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
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
      references: {
        model: 'clients',
        key: 'id',
      },
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'project_id',
      references: {
        model: 'projects',
        key: 'id',
      },
    },
    designationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'designation_id',
      references: {
        model: 'designations',
        key: 'id',
      },
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
    remarks: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'employee_assignments',
    timestamps: true,
    underscored: true,
  },
);

Employee.hasMany(EmployeeAssignment, { foreignKey: 'employee_id', as: 'assignments' });
EmployeeAssignment.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Client.hasMany(EmployeeAssignment, { foreignKey: 'client_id', as: 'assignments' });
EmployeeAssignment.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

Project.hasMany(EmployeeAssignment, { foreignKey: 'project_id', as: 'assignments' });
EmployeeAssignment.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Designation.hasMany(EmployeeAssignment, { foreignKey: 'designation_id', as: 'assignments' });
EmployeeAssignment.belongsTo(Designation, { foreignKey: 'designation_id', as: 'designation' });
