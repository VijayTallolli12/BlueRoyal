import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('employees', 'employment_type', {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'full_time',
  });

  await queryInterface.addColumn('employees', 'contract_end_date', {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('employees', 'contract_end_date');
  await queryInterface.removeColumn('employees', 'employment_type');
}
