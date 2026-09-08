import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Client } from './client.model';

export class Project extends BaseModel {
  declare public clientId: string;
  declare public code: string;
  declare public name: string;
  declare public siteLocation: string | null;
  declare public startDate: string | null;
  declare public endDate: string | null;
  declare public status: string;
  declare public deletedAt: Date | null;

  declare public client?: Client;
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
