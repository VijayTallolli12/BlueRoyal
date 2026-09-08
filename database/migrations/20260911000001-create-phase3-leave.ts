import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // 1. leave_types
  await queryInterface.createTable('leave_types', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(32),
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
    is_paid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    default_days_per_year: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 30.0,
    },
    requires_attachment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    deduct_working_days_only: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    allow_during_probation: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await queryInterface.addIndex('leave_types', ['code'], { unique: true });
  await queryInterface.addIndex('leave_types', ['is_active']);

  // 2. employee_leave_balances
  await queryInterface.createTable('employee_leave_balances', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'employees', key: 'id' },
      onDelete: 'RESTRICT',
    },
    leave_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'leave_types', key: 'id' },
      onDelete: 'RESTRICT',
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    allocated_days: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    used_days: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    pending_days: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    carried_forward: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex('employee_leave_balances', ['employee_id', 'leave_type_id', 'year'], {
    unique: true,
    name: 'uq_employee_leave_type_year',
  });
  await queryInterface.addIndex('employee_leave_balances', ['employee_id', 'year']);

  // 3. leave_requests
  await queryInterface.createTable('leave_requests', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    request_number: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'employees', key: 'id' },
      onDelete: 'RESTRICT',
    },
    leave_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'leave_types', key: 'id' },
      onDelete: 'RESTRICT',
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    total_days: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejected_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    rejected_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancelled_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attachment_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex('leave_requests', ['request_number'], { unique: true });
  await queryInterface.addIndex('leave_requests', ['employee_id', 'status']);
  await queryInterface.addIndex('leave_requests', ['start_date', 'end_date']);
  await queryInterface.addIndex('leave_requests', ['status']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('leave_requests');
  await queryInterface.dropTable('employee_leave_balances');
  await queryInterface.dropTable('leave_types');
}
