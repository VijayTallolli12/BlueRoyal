import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';

export class DocumentType extends BaseModel {
  declare public code: string;
  declare public name: string;
  declare public description: string | null;
  declare public isMandatory: boolean;
  declare public hasExpiry: boolean;
  declare public expiryAlertDays: number;
  declare public allowedMimeTypes: string[];
  declare public maxSizeBytes: number;
  declare public isActive: boolean;
}

DocumentType.init(
  {
    ...baseModelAttributes,
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isMandatory: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_mandatory_for_onboarding',
    },
    hasExpiry: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'has_expiry',
    },
    expiryAlertDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      field: 'default_expiry_alert_days',
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
    tableName: 'document_types',
    timestamps: true,
    underscored: true,
  },
);
