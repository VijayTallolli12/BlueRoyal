import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // 1. Create document_types table
  await queryInterface.createTable('document_types', {
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
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_mandatory_for_onboarding: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    has_expiry: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    default_expiry_alert_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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

  // 2. Create employee_documents table
  await queryInterface.createTable('employee_documents', {
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
      onDelete: 'CASCADE',
    },
    document_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'document_types', key: 'id' },
      onDelete: 'RESTRICT',
    },
    document_number: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    issue_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    file_size_bytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    verification_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
    },
    verified_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verification_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  // Indexes for employee_documents
  await queryInterface.addIndex('employee_documents', ['employee_id'], { name: 'idx_emp_docs_employee_id' });
  await queryInterface.addIndex('employee_documents', ['document_type_id'], { name: 'idx_emp_docs_type_id' });
  await queryInterface.addIndex('employee_documents', ['expiry_date'], { name: 'idx_emp_docs_expiry_date' });
  await queryInterface.addIndex('employee_documents', ['verification_status'], { name: 'idx_emp_docs_verif_status' });

  // 3. Create employee_onboardings table
  await queryInterface.createTable('employee_onboardings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'employees', key: 'id' },
      onDelete: 'CASCADE',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
    },
    current_step: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'personal_info',
    },
    completion_percentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    checklist_progress: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    target_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
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

  await queryInterface.addIndex('employee_onboardings', ['employee_id'], { name: 'idx_onboardings_employee_id' });
  await queryInterface.addIndex('employee_onboardings', ['status'], { name: 'idx_onboardings_status' });

  // 4. Seed initial default document types
  const now = new Date();
  const defaultTypes = [
    {
      id: 'a0000001-0000-0000-0000-000000000001',
      code: 'PASSPORT',
      name: 'Passport Copy',
      description: 'First page and visa stamp page scan',
      is_mandatory_for_onboarding: true,
      has_expiry: true,
      default_expiry_alert_days: 60,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'a0000001-0000-0000-0000-000000000002',
      code: 'VISA',
      name: 'Residence / Employment Visa',
      description: 'UAE Residence employment entry permit or visa stamp',
      is_mandatory_for_onboarding: true,
      has_expiry: true,
      default_expiry_alert_days: 30,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'a0000001-0000-0000-0000-000000000003',
      code: 'EMIRATES_ID',
      name: 'Emirates ID (Front & Back)',
      description: 'Federal Identity Authority digital or physical ID card',
      is_mandatory_for_onboarding: true,
      has_expiry: true,
      default_expiry_alert_days: 30,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'a0000001-0000-0000-0000-000000000004',
      code: 'LABOR_CARD',
      name: 'MOHRE Labor Card / Work Permit',
      description: 'Ministry of Human Resources & Emiratisation permit',
      is_mandatory_for_onboarding: false,
      has_expiry: true,
      default_expiry_alert_days: 30,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'a0000001-0000-0000-0000-000000000005',
      code: 'DRIVING_LICENSE',
      name: 'Driving License',
      description: 'UAE or GCC valid vehicular operating license',
      is_mandatory_for_onboarding: false,
      has_expiry: true,
      default_expiry_alert_days: 30,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'a0000001-0000-0000-0000-000000000006',
      code: 'OFFER_LETTER',
      name: 'Signed Employment Contract / Offer Letter',
      description: 'Executed employment terms agreement',
      is_mandatory_for_onboarding: false,
      has_expiry: false,
      default_expiry_alert_days: 0,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('document_types', defaultTypes);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('employee_onboardings');
  await queryInterface.dropTable('employee_documents');
  await queryInterface.dropTable('document_types');
}
