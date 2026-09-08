import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // 1. attendance_periods
  await queryInterface.createTable('attendance_periods', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    period_code: {
      type: DataTypes.STRING(7),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(64),
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
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
    },
    submitted_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    submitted_at: {
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
    locked_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    locked_at: {
      type: DataTypes.DATE,
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
    unlock_reason: {
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

  // 2. attendance_records
  await queryInterface.createTable('attendance_records', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    attendance_period_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'attendance_periods', key: 'id' },
      onDelete: 'RESTRICT',
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'employees', key: 'id' },
      onDelete: 'RESTRICT',
    },
    work_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    client_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'clients', key: 'id' },
      onDelete: 'RESTRICT',
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'projects', key: 'id' },
      onDelete: 'RESTRICT',
    },
    designation_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'designations', key: 'id' },
      onDelete: 'RESTRICT',
    },
    shift_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'shifts', key: 'id' },
      onDelete: 'SET NULL',
    },
    day_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'regular_workday',
    },
    actual_hours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    regular_hours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    ot_hours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    is_absent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_on_leave: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    has_anomaly: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    anomaly_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    remarks: {
      type: DataTypes.STRING(255),
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

  await queryInterface.addConstraint('attendance_records', {
    fields: ['employee_id', 'work_date'],
    type: 'unique',
    name: 'uq_attendance_employee_date',
  });

  await queryInterface.addIndex('attendance_records', ['attendance_period_id'], {
    name: 'idx_attendance_period',
  });
  await queryInterface.addIndex('attendance_records', ['employee_id', 'work_date'], {
    name: 'idx_attendance_emp_date',
  });
  await queryInterface.addIndex('attendance_records', ['work_date'], {
    name: 'idx_attendance_work_date',
  });
  await queryInterface.addIndex('attendance_records', ['client_id', 'project_id', 'work_date'], {
    name: 'idx_attendance_client_proj_date',
  });

  // 3. attendance_audit_logs
  await queryInterface.createTable('attendance_audit_logs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    attendance_record_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'attendance_records', key: 'id' },
      onDelete: 'CASCADE',
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'employees', key: 'id' },
      onDelete: 'RESTRICT',
    },
    work_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    field_name: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    old_value: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    new_value: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    change_reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    actor_id: {
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
  });

  await queryInterface.addIndex('attendance_audit_logs', ['attendance_record_id'], {
    name: 'idx_attendance_audit_record',
  });
  await queryInterface.addIndex('attendance_audit_logs', ['employee_id', 'work_date'], {
    name: 'idx_attendance_audit_emp_date',
  });
  await queryInterface.addIndex('attendance_audit_logs', ['created_at'], {
    name: 'idx_attendance_audit_created',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('attendance_audit_logs');
  await queryInterface.dropTable('attendance_records');
  await queryInterface.dropTable('attendance_periods');
}
