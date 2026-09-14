import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Client } from '../../masters/models/client.model';
import { User } from '../../auth/models/user.model';
import { InvoicePaymentAllocation } from './invoice-payment-allocation.model';

export class ClientPayment extends BaseModel {
  declare public paymentNumber: string;
  declare public clientId: string;
  declare public paymentDate: string;
  declare public amount: number;
  declare public currency: string;
  declare public paymentMethod: string;
  declare public referenceNumber: string | null;
  declare public notes: string | null;
  declare public status: string;
  declare public recordedBy: string;
  declare public reversedAt: Date | null;
  declare public reversedBy: string | null;
  declare public reversalReason: string | null;

  declare public client?: Client;
  declare public recordedByUser?: User;
  declare public reversedByUser?: User;
  declare public allocations?: InvoicePaymentAllocation[];
}

ClientPayment.init(
  {
    ...baseModelAttributes,
    paymentNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'payment_number',
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
      references: { model: 'clients', key: 'id' },
    },
    paymentDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'payment_date',
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'amount',
      get() {
        const val = this.getDataValue('amount');
        return val !== null && val !== undefined ? parseFloat(val as any) : 0;
      },
    },
    currency: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'AED',
      field: 'currency',
    },
    paymentMethod: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'payment_method',
    },
    referenceNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'reference_number',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'notes',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'RECORDED',
      field: 'status',
    },
    recordedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'recorded_by',
      references: { model: 'users', key: 'id' },
    },
    reversedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reversed_at',
    },
    reversedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reversed_by',
      references: { model: 'users', key: 'id' },
    },
    reversalReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'reversal_reason',
    },
  },
  {
    sequelize,
    tableName: 'client_payments',
    timestamps: true,
    underscored: true,
  },
);

ClientPayment.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
ClientPayment.belongsTo(User, { foreignKey: 'recorded_by', as: 'recordedByUser' });
ClientPayment.belongsTo(User, { foreignKey: 'reversed_by', as: 'reversedByUser' });
Client.hasMany(ClientPayment, { foreignKey: 'client_id', as: 'payments' });
