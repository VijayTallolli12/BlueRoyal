import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class AirTicketPolicy extends BaseModel {
  declare public countryCode: string | null;
  declare public countryName: string;
  declare public region: string;
  declare public entitlementAmount: number;
  declare public isActive: boolean;
  declare public notes: string | null;
}

AirTicketPolicy.init(
  {
    ...baseModelAttributes,
    countryCode: {
      type: DataTypes.STRING(8),
      allowNull: true,
      field: 'country_code',
    },
    countryName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'country_name',
    },
    region: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    entitlementAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'entitlement_amount',
      get(): number {
        const val = this.getDataValue('entitlementAmount');
        return val !== null ? Number(val) : 0;
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'air_ticket_policies',
    timestamps: true,
    underscored: true,
  },
);
