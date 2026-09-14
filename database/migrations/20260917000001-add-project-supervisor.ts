import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('projects', 'supervisor_id', {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'employees',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });

  await queryInterface.addIndex('projects', ['supervisor_id'], {
    name: 'idx_projects_supervisor',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex('projects', 'idx_projects_supervisor');
  await queryInterface.removeColumn('projects', 'supervisor_id');
}
