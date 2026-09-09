import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { FinalSettlement } from './final-settlement.model';
import { User } from '../../auth/models/user.model';
import { SettlementLineCategory, SettlementAdjustmentType } from '@blue-royal/contracts';

export class SettlementItemLine extends BaseModel {
  declare public settlementId: string;
  declare public category: SettlementLineCategory;
  declare public code: string;
  declare public description: string;
  declare public isManual: boolean;
  declare public adjustmentType: SettlementAdjustmentType;
  declare public quantity: number | null;
  declare public rate: number | null;
  declare public amount: number;
  declare public calculationNotes: string | null;
  declare public createdBy: string | null;

  declare public settlement?: FinalSettlement;
  declare public creator?: User;
}

SettlementItemLine.init(
  {
    ...baseModelAttributes,
    settlementId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'settlement_id',
      references: {
        model: 'final_settlements',
        key: 'id',
      },
    },
    category: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    isManual: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_manual',
    },
    adjustmentType: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'addition',
      field: 'adjustment_type',
    },
    quantity: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      get(): number | null {
        const val = this.getDataValue('quantity');
        return val !== null && val !== undefined ? Number(val) : null;
      },
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get(): number | null {
        const val = this.getDataValue('rate');
        return val !== null && val !== undefined ? Number(val) : null;
      },
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      get(): number {
        const val = this.getDataValue('amount');
        return val !== null ? Number(val) : 0;
      },
    },
    calculationNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'calculation_notes',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'settlement_item_lines',
    timestamps: true,
    underscored: true,
  },
);

SettlementItemLine.belongsTo(FinalSettlement, { foreignKey: 'settlement_id', as: 'settlement' });
FinalSettlement.hasMany(SettlementItemLine, { foreignKey: 'settlement_id', as: 'lines' });

SettlementItemLine.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
