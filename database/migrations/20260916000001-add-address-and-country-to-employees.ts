import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('employees', 'address', {
    type: DataTypes.TEXT,
    allowNull: true,
  });

  await queryInterface.addColumn('employees', 'country', {
    type: DataTypes.STRING(64),
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('employees', 'country');
  await queryInterface.removeColumn('employees', 'address');
}

