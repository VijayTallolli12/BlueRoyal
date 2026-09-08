import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { PayrollItem } from './payroll-item.model';
import { SalaryComponent } from '../../masters/models/salary-component.model';
import { User } from '../../auth/models/user.model';
import { PayrollLineCategory, PayrollAdjustmentType } from '@blue-royal/contracts';

export class PayrollItemLine extends BaseModel {
  declare public payrollItemId: string;
  declare public category: PayrollLineCategory;
  declare public isManual: boolean;
  declare public adjustmentType: PayrollAdjustmentType | null;
  declare public code: string;
  declare public description: string;
  declare public rate: number | null;
  declare public quantity: number | null;
  declare public amount: number;
  declare public salaryComponentId: string | null;
  declare public workDate: string | null;
  declare public createdBy: string | null;

  declare public payrollItem?: PayrollItem;
  declare public salaryComponent?: SalaryComponent;
  declare public createdByUser?: User;
}

PayrollItemLine.init(
  {
    ...baseModelAttributes,
    payrollItemId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'payroll_item_id',
      references: {
        model: 'payroll_items',
        key: 'id',
      },
    },
    category: {
      type: DataTypes.STRING(16),
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
      allowNull: true,
      field: 'adjustment_type',
    },
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const val = this.getDataValue('rate');
        return val === null ? null : Number(val);
      },
    },
    quantity: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      get() {
        const val = this.getDataValue('quantity');
        return val === null ? null : Number(val);
      },
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue('amount');
        return val === null ? 0 : Number(val);
      },
    },
    salaryComponentId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'salary_component_id',
      references: {
        model: 'salary_components',
        key: 'id',
      },
    },
    workDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'work_date',
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
    tableName: 'payroll_item_lines',
    timestamps: true,
    underscored: true,
  },
);

PayrollItemLine.belongsTo(PayrollItem, { foreignKey: 'payroll_item_id', as: 'payrollItem' });
PayrollItemLine.belongsTo(SalaryComponent, { foreignKey: 'salary_component_id', as: 'salaryComponent' });
PayrollItemLine.belongsTo(User, { foreignKey: 'created_by', as: 'createdByUser' });
PayrollItem.hasMany(PayrollItemLine, { foreignKey: 'payroll_item_id', as: 'lines' });
