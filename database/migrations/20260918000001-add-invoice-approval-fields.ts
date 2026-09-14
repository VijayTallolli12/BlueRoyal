import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // 1. Add approval and rejection columns to client_invoices
  await queryInterface.addColumn('client_invoices', 'approved_at', {
    type: DataTypes.DATE,
    allowNull: true,
  });

  await queryInterface.addColumn('client_invoices', 'approved_by', {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL',
  });

  await queryInterface.addColumn('client_invoices', 'rejected_at', {
    type: DataTypes.DATE,
    allowNull: true,
  });

  await queryInterface.addColumn('client_invoices', 'rejected_by', {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL',
  });

  await queryInterface.addColumn('client_invoices', 'rejection_reason', {
    type: DataTypes.TEXT,
    allowNull: true,
  });

  // 2. Add designation_title to client_invoice_lines for point-in-time worker trade tracking
  await queryInterface.addColumn('client_invoice_lines', 'designation_title', {
    type: DataTypes.STRING(100),
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('client_invoice_lines', 'designation_title');
  await queryInterface.removeColumn('client_invoices', 'rejection_reason');
  await queryInterface.removeColumn('client_invoices', 'rejected_by');
  await queryInterface.removeColumn('client_invoices', 'rejected_at');
  await queryInterface.removeColumn('client_invoices', 'approved_by');
  await queryInterface.removeColumn('client_invoices', 'approved_at');
}
