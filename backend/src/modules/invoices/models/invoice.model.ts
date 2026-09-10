import { DataTypes } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { BaseModel, baseModelAttributes } from '../../../core/database/base.model';
import { Client } from '../../masters/models/client.model';
import { Project } from '../../masters/models/project.model';
import { User } from '../../auth/models/user.model';
import { InvoiceStatus } from '@blue-royal/contracts';
import { InvoiceLine } from './invoice-line.model';

export class Invoice extends BaseModel {
  declare public invoiceNumber: string;
  declare public clientId: string;
  declare public projectId: string;
  declare public billingPeriod: string;
  declare public invoiceDate: string;
  declare public status: InvoiceStatus;
  declare public subtotal: number;
  declare public taxAmount: number;
  declare public totalAmount: number;
  declare public currency: string;
  declare public notes: string | null;
  declare public issuedAt: Date | null;
  declare public issuedBy: string | null;

  declare public client?: Client;
  declare public project?: Project;
  declare public issuedByUser?: User;
  declare public lines?: InvoiceLine[];
}

Invoice.init(
  {
    ...baseModelAttributes,
    invoiceNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'invoice_number',
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
      references: { model: 'clients', key: 'id' },
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'project_id',
      references: { model: 'projects', key: 'id' },
    },
    billingPeriod: {
      type: DataTypes.STRING(7),
      allowNull: false,
      field: 'billing_period',
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'invoice_date',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
      field: 'status',
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'subtotal',
    },
    taxAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'tax_amount',
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'total_amount',
    },
    currency: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'AED',
      field: 'currency',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'notes',
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'issued_at',
    },
    issuedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'issued_by',
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'client_invoices',
    timestamps: true,
    underscored: true,
  },
);

Invoice.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
Invoice.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Invoice.belongsTo(User, { foreignKey: 'issued_by', as: 'issuedByUser' });
Invoice.hasMany(InvoiceLine, { foreignKey: 'invoice_id', as: 'lines' });
InvoiceLine.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
