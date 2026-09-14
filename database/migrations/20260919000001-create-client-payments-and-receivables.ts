import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // 1. Add due_date to client_invoices as nullable DATEONLY without default or backfill
  await queryInterface.addColumn('client_invoices', 'due_date', {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });

  // 2. Create client_payments table
  await queryInterface.createTable('client_payments', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    payment_number: {
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
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'AED',
    },
    payment_method: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    reference_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'RECORDED',
    },
    recorded_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'RESTRICT',
    },
    reversed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reversed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    reversal_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
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

  // 3. Create invoice_payment_allocations table
  // No cascade deletion: strict financial integrity with onDelete: 'RESTRICT'
  await queryInterface.createTable('invoice_payment_allocations', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    payment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'client_payments', key: 'id' },
      onDelete: 'RESTRICT',
    },
    invoice_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'client_invoices', key: 'id' },
      onDelete: 'RESTRICT',
    },
    allocated_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'RESTRICT',
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

  // 4. Indexes for financial lookups and duplicate prevention
  await queryInterface.addIndex('client_payments', ['payment_number'], { unique: true });
  await queryInterface.addIndex('client_payments', ['client_id']);
  await queryInterface.addIndex('client_payments', ['payment_date']);
  await queryInterface.addIndex('client_payments', ['status']);
  await queryInterface.addIndex('client_payments', ['client_id', 'reference_number']);

  await queryInterface.addIndex('invoice_payment_allocations', ['payment_id']);
  await queryInterface.addIndex('invoice_payment_allocations', ['invoice_id']);

  // 5. Seed Permissions & Role Mappings
  const permissionsToSeed = [
    { code: 'payments:read', description: 'View client payments and receipts', module: 'payments' },
    { code: 'payments:create', description: 'Record client payments and allocations', module: 'payments' },
    { code: 'payments:reverse', description: 'Reverse client payments with reason', module: 'payments' },
    { code: 'receivables:read', description: 'View client receivables aging and ledger', module: 'receivables' },
  ];

  for (const perm of permissionsToSeed) {
    await queryInterface.sequelize.query(
      `INSERT INTO permissions (id, code, description, module, created_at, updated_at)
       VALUES (gen_random_uuid(), :code, :description, :module, NOW(), NOW())
       ON CONFLICT (code) DO UPDATE SET
         description = EXCLUDED.description,
         module = EXCLUDED.module,
         updated_at = NOW();`,
      { replacements: perm },
    );
  }

  // Grant to super_admin (all invoice, payment, and receivable permissions)
  await queryInterface.sequelize.query(
    `INSERT INTO role_permissions (role_id, permission_id, created_at)
     SELECT r.id, p.id, NOW()
     FROM roles r
     CROSS JOIN permissions p
     WHERE r.name = 'super_admin'
       AND p.code IN (
         'invoices:read', 'invoices:create', 'invoices:issue',
         'payments:read', 'payments:create', 'payments:reverse',
         'receivables:read'
       )
     ON CONFLICT DO NOTHING;`,
  );

  // Grant to hr_admin (invoice access, payment operations, receivables view)
  await queryInterface.sequelize.query(
    `INSERT INTO role_permissions (role_id, permission_id, created_at)
     SELECT r.id, p.id, NOW()
     FROM roles r
     CROSS JOIN permissions p
     WHERE r.name = 'hr_admin'
       AND p.code IN (
         'invoices:read', 'invoices:create', 'invoices:issue',
         'payments:read', 'payments:create', 'payments:reverse',
         'receivables:read'
       )
     ON CONFLICT DO NOTHING;`,
  );
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // 1. Remove permissions from role_permissions
  await queryInterface.sequelize.query(
    `DELETE FROM role_permissions
     WHERE permission_id IN (
       SELECT id FROM permissions WHERE code IN (
         'payments:read', 'payments:create', 'payments:reverse', 'receivables:read'
       )
     );`,
  );

  // 2. Remove permissions
  await queryInterface.sequelize.query(
    `DELETE FROM permissions
     WHERE code IN ('payments:read', 'payments:create', 'payments:reverse', 'receivables:read');`,
  );

  // 3. Drop tables and columns
  await queryInterface.dropTable('invoice_payment_allocations');
  await queryInterface.dropTable('client_payments');
  await queryInterface.removeColumn('client_invoices', 'due_date');
}
