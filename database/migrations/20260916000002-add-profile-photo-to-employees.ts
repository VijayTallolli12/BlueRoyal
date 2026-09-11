import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const table = await queryInterface.describeTable('employees');
  if (!table['profile_photo']) {
    await queryInterface.addColumn('employees', 'profile_photo', {
      type: DataTypes.STRING(500),
      allowNull: true,
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const table = await queryInterface.describeTable('employees');
  if (table['profile_photo']) {
    await queryInterface.removeColumn('employees', 'profile_photo');
  }
}

