import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Client } from './client.model';
import { Project } from './project.model';
import { Designation } from './designation.model';

export class ClientBillingRate extends BaseModel {
  declare public clientId: string;
  declare public projectId: string | null;
  declare public designationId: string;
  declare public normalBillingRate: number;
  declare public otBillingRate: number;
  declare public effectiveFrom: string;
  declare public effectiveTo: string | null;

  declare public client?: Client;
  declare public project?: Project;
  declare public designation?: Designation;
}

ClientBillingRate.init(
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
    projectId: {
      type: DataTypes.UUID,
      allowNull: true,
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
    normalBillingRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'normal_billing_rate',
    },
    otBillingRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'ot_billing_rate',
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
    tableName: 'client_billing_rates',
    timestamps: true,
    underscored: true,
  },
);

Client.hasMany(ClientBillingRate, { foreignKey: 'client_id', as: 'billingRates' });
ClientBillingRate.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

Project.hasMany(ClientBillingRate, { foreignKey: 'project_id', as: 'billingRates' });
ClientBillingRate.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Designation.hasMany(ClientBillingRate, { foreignKey: 'designation_id', as: 'billingRates' });
ClientBillingRate.belongsTo(Designation, { foreignKey: 'designation_id', as: 'designation' });
