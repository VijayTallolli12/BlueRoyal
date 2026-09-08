import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class Client extends BaseModel {
  declare public code: string;
  declare public name: string;
  declare public contactPerson: string | null;
  declare public contactEmail: string | null;
  declare public contactPhone: string | null;
  declare public billingAddress: string | null;
  declare public isActive: boolean;
  declare public deletedAt: Date | null;
}

Client.init(
  {
    ...baseModelAttributes,
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    contactPerson: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'contact_person',
    },
    contactEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'contact_email',
    },
    contactPhone: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'contact_phone',
    },
    billingAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'billing_address',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    sequelize,
    tableName: 'clients',
    paranoid: true,
    timestamps: true,
    underscored: true,
  },
);
