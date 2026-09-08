import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // 1. Add remuneration_basis to employees
  await queryInterface.addColumn('employees', 'remuneration_basis', {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'hourly',
  });

  await queryInterface.sequelize.query(`
    ALTER TABLE employees 
    ADD CONSTRAINT chk_employees_remuneration_basis 
    CHECK (remuneration_basis IN ('hourly', 'salaried'));
  `);

  // 2. Create payroll_periods table
  await queryInterface.createTable('payroll_periods', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    period_code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    attendance_period_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'attendance_periods', key: 'id' },
      onDelete: 'RESTRICT',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
    },
    total_gross_pay: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    total_deductions: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    total_net_pay: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    employee_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    blocking_issues_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    calculated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    calculated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finalized_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    finalized_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    unlock_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    unlocked_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    unlocked_at: {
      type: DataTypes.DATE,
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

  await queryInterface.sequelize.query(`
    ALTER TABLE payroll_periods 
    ADD CONSTRAINT chk_payroll_period_dates CHECK (end_date >= start_date);
  `);

  await queryInterface.sequelize.query(`
    ALTER TABLE payroll_periods 
    ADD CONSTRAINT chk_payroll_period_status CHECK (status IN ('draft', 'calculated', 'reviewed', 'finalized'));
  `);

  // 3. Create payroll_items table
  await queryInterface.createTable('payroll_items', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    payroll_period_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'payroll_periods', key: 'id' },
      onDelete: 'CASCADE',
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'employees', key: 'id' },
      onDelete: 'RESTRICT',
    },
    remuneration_basis: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    designation_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'designations', key: 'id' },
      onDelete: 'RESTRICT',
    },
    days_in_period: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_actual_hours: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    total_regular_hours: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    total_ot_hours: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    total_absence_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_leave_days: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    gross_pay: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    total_deductions: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    net_pay: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    has_blocking_issue: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    blocking_reason: {
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

  await queryInterface.addIndex('payroll_items', ['payroll_period_id', 'employee_id'], {
    unique: true,
    name: 'uq_payroll_item_emp_period',
  });

  await queryInterface.addIndex('payroll_items', ['employee_id', 'payroll_period_id'], {
    name: 'idx_payroll_item_lookup',
  });

  // 4. Create payroll_item_lines table
  await queryInterface.createTable('payroll_item_lines', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    payroll_item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'payroll_items', key: 'id' },
      onDelete: 'CASCADE',
    },
    category: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    is_manual: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    adjustment_type: {
      type: DataTypes.STRING(16),
      allowNull: true,
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
    },
    quantity: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    salary_component_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'salary_components', key: 'id' },
      onDelete: 'RESTRICT',
    },
    work_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    created_by: {
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

  await queryInterface.sequelize.query(`
    ALTER TABLE payroll_item_lines 
    ADD CONSTRAINT chk_payroll_lines_category CHECK (category IN ('earning', 'deduction', 'adjustment'));
  `);

  await queryInterface.sequelize.query(`
    ALTER TABLE payroll_item_lines 
    ADD CONSTRAINT chk_payroll_lines_adjustment_type CHECK (adjustment_type IS NULL OR adjustment_type IN ('addition', 'deduction'));
  `);

  await queryInterface.addIndex('payroll_item_lines', ['payroll_item_id', 'category'], {
    name: 'idx_payroll_lines_item',
  });

  await queryInterface.addIndex('payroll_item_lines', ['payroll_item_id', 'is_manual'], {
    name: 'idx_payroll_lines_manual',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('payroll_item_lines');
  await queryInterface.dropTable('payroll_items');
  await queryInterface.dropTable('payroll_periods');
  await queryInterface.removeColumn('employees', 'remuneration_basis');
}
