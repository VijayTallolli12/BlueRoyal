import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { ClientPayment } from './client-payment.model';
import { Invoice } from './invoice.model';
import { User } from '../../auth/models/user.model';

export class InvoicePaymentAllocation extends BaseModel {
  declare public paymentId: string;
  declare public invoiceId: string;
  declare public allocatedAmount: number;
  declare public createdBy: string;

  declare public payment?: ClientPayment;
  declare public invoice?: Invoice;
  declare public createdByUser?: User;
}

InvoicePaymentAllocation.init(
  {
    ...baseModelAttributes,
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'payment_id',
      references: { model: 'client_payments', key: 'id' },
    },
    invoiceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'invoice_id',
      references: { model: 'client_invoices', key: 'id' },
    },
    allocatedAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'allocated_amount',
      get() {
        const val = this.getDataValue('allocatedAmount');
        return val !== null && val !== undefined ? parseFloat(val as any) : 0;
      },
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'invoice_payment_allocations',
    timestamps: true,
    underscored: true,
  },
);

InvoicePaymentAllocation.belongsTo(ClientPayment, { foreignKey: 'payment_id', as: 'payment' });
ClientPayment.hasMany(InvoicePaymentAllocation, { foreignKey: 'payment_id', as: 'allocations' });

InvoicePaymentAllocation.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
Invoice.hasMany(InvoicePaymentAllocation, { foreignKey: 'invoice_id', as: 'allocations' });

InvoicePaymentAllocation.belongsTo(User, { foreignKey: 'created_by', as: 'createdByUser' });
