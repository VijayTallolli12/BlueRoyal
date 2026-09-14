import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Client } from './client.model';
import { Employee } from './employee.model';

export class Project extends BaseModel {
  declare public clientId: string;
  declare public code: string;
  declare public name: string;
  declare public siteLocation: string | null;
  declare public startDate: string | null;
  declare public endDate: string | null;
  declare public status: string;
  declare public supervisorId: string | null;
  declare public deletedAt: Date | null;

  declare public client?: Client;
  declare public supervisor?: Employee;

  public get location(): string | null {
    return this.siteLocation;
  }

  public override toJSON(): Record<string, unknown> {
    const values = { ...(super.toJSON() as Record<string, unknown>) };
    values['location'] = this.siteLocation;
    return values;
  }
}

Project.init(
  {
    ...baseModelAttributes,
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
      references: {
        model: 'clients',
        key: 'id',
      },
    },
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    siteLocation: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'site_location',
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'start_date',
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'end_date',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'active',
    },
    supervisorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'supervisor_id',
      references: {
        model: 'employees',
        key: 'id',
      },
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    sequelize,
    tableName: 'projects',
    paranoid: true,
    timestamps: true,
    underscored: true,
  },
);

Client.hasMany(Project, { foreignKey: 'client_id', as: 'projects' });
Project.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

Employee.hasMany(Project, { foreignKey: 'supervisor_id', as: 'supervisedProjects' });
Project.belongsTo(Employee, { foreignKey: 'supervisor_id', as: 'supervisor' });

