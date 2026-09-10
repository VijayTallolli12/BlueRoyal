import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // 1. Create client_invoices table
  await queryInterface.createTable('client_invoices', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    invoice_number: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    client_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'clients', key: 'id' },
      onDelete: 'RESTRICT',
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'projects', key: 'id' },
      onDelete: 'RESTRICT',
    },
    billing_period: {
      type: DataTypes.STRING(7), // e.g. "2026-08"
      allowNull: false,
    },
    invoice_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    tax_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'AED',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    issued_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    issued_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  // 2. Create client_invoice_lines table
  await queryInterface.createTable('client_invoice_lines', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    invoice_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'client_invoices', key: 'id' },
      onDelete: 'CASCADE',
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'employees', key: 'id' },
      onDelete: 'SET NULL',
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'projects', key: 'id' },
      onDelete: 'RESTRICT',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    hours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
    },
    overtime_hours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    ot_rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    line_type: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'billable_hours',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  // Indexes
  await queryInterface.addIndex('client_invoices', ['invoice_number'], { unique: true });
  await queryInterface.addIndex('client_invoices', ['client_id', 'project_id', 'billing_period']);
  await queryInterface.addIndex('client_invoice_lines', ['invoice_id']);
  await queryInterface.addIndex('client_invoice_lines', ['employee_id']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('client_invoice_lines');
  await queryInterface.dropTable('client_invoices');
}
