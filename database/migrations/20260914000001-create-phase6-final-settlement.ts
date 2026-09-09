import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // 1. Create air_ticket_policies table (Configurable policy structure - BR-04)
  await queryInterface.createTable('air_ticket_policies', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    country_code: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    country_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    region: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    entitlement_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    notes: {
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

  // 2. Create employee_separations table
  await queryInterface.createTable('employee_separations', {
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
    separation_type: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    notice_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    last_working_day: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    contractual_notice_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    actual_notice_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    repatriation_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    destination_country: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    has_new_uae_employment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    clearance_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
    },
    clearance_details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        itAssetsReturned: false,
        accessCardsReturned: false,
        loansReconciled: false,
        visaCancellationInitiated: false,
      },
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
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

  await queryInterface.addIndex('employee_separations', ['employee_id'], { name: 'idx_separations_employee_id' });
  await queryInterface.addIndex('employee_separations', ['status'], { name: 'idx_separations_status' });

  // 3. Create final_settlements table
  await queryInterface.createTable('final_settlements', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    settlement_code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    separation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'employee_separations', key: 'id' },
      onDelete: 'RESTRICT',
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'employees', key: 'id' },
      onDelete: 'RESTRICT',
    },
    service_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    last_working_day: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    total_service_calendar_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unpaid_leave_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    net_service_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    service_years: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    remuneration_basis: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    last_basic_salary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    daily_basic_wage: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    daily_gross_wage: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    gratuity_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    gratuity_withheld: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    gratuity_withhold_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    leave_balance_days: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    leave_salary_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    air_ticket_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    final_wages_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    notice_shortfall_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    gross_additions: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    total_deductions: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    net_settlement_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
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
    notes: {
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

  await queryInterface.addIndex('final_settlements', ['employee_id'], { name: 'idx_settlements_employee_id' });
  await queryInterface.addIndex('final_settlements', ['status'], { name: 'idx_settlements_status' });
  await queryInterface.addIndex('final_settlements', ['settlement_code'], { name: 'idx_settlements_code' });

  // 4. Create settlement_item_lines table
  await queryInterface.createTable('settlement_item_lines', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    settlement_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'final_settlements', key: 'id' },
      onDelete: 'CASCADE',
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
    is_manual: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    adjustment_type: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'addition',
    },
    quantity: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    calculation_notes: {
      type: DataTypes.TEXT,
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

  await queryInterface.addIndex('settlement_item_lines', ['settlement_id'], { name: 'idx_settlement_lines_settlement_id' });

  // 5. Seed initial configurable air ticket policies
  const now = new Date();
  const defaultPolicies = [
    {
      id: 'b0000001-0000-0000-0000-000000000001',
      country_code: 'PHL',
      country_name: 'Philippines',
      region: 'Southeast Asia',
      entitlement_amount: 2000.0,
      is_active: true,
      notes: 'Standard repatriation flight entitlement',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'b0000001-0000-0000-0000-000000000002',
      country_code: 'IND',
      country_name: 'India',
      region: 'South Asia',
      entitlement_amount: 1500.0,
      is_active: true,
      notes: 'Standard repatriation flight entitlement',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'b0000001-0000-0000-0000-000000000003',
      country_code: 'PAK',
      country_name: 'Pakistan',
      region: 'South Asia',
      entitlement_amount: 1500.0,
      is_active: true,
      notes: 'Standard repatriation flight entitlement',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'b0000001-0000-0000-0000-000000000004',
      country_code: 'BGD',
      country_name: 'Bangladesh',
      region: 'South Asia',
      entitlement_amount: 1500.0,
      is_active: true,
      notes: 'Standard repatriation flight entitlement',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'b0000001-0000-0000-0000-000000000005',
      country_code: 'NPL',
      country_name: 'Nepal',
      region: 'South Asia',
      entitlement_amount: 1500.0,
      is_active: true,
      notes: 'Standard repatriation flight entitlement',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'b0000001-0000-0000-0000-000000000006',
      country_code: 'LKA',
      country_name: 'Sri Lanka',
      region: 'South Asia',
      entitlement_amount: 1500.0,
      is_active: true,
      notes: 'Standard repatriation flight entitlement',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'b0000001-0000-0000-0000-000000000007',
      country_code: 'EGY',
      country_name: 'Egypt',
      region: 'Middle East & North Africa',
      entitlement_amount: 1400.0,
      is_active: true,
      notes: 'Standard repatriation flight entitlement',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'b0000001-0000-0000-0000-000000000008',
      country_code: 'DEFAULT',
      country_name: 'Other International (Standard)',
      region: 'Global',
      entitlement_amount: 2000.0,
      is_active: true,
      notes: 'Default global repatriation fallback policy',
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('air_ticket_policies', defaultPolicies);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('settlement_item_lines');
  await queryInterface.dropTable('final_settlements');
  await queryInterface.dropTable('employee_separations');
  await queryInterface.dropTable('air_ticket_policies');
}
