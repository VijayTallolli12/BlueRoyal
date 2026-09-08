import path from 'path';
import { Umzug, SequelizeStorage } from 'umzug';
import { QueryInterface } from 'sequelize';
import { sequelize } from './config/db';

export const migrator = new Umzug({
  migrations: {
    glob: ['migrations/*.ts', { cwd: path.resolve(__dirname, '..') }],
    resolve: ({ name, path: migrationPath, context }) => {
      return {
        name,
        up: async () => {
          const migration = await import(migrationPath as string);
          return migration.up(context);
        },
        down: async () => {
          const migration = await import(migrationPath as string);
          return migration.down(context);
        },
      };
    },
  },
  context: sequelize.getQueryInterface() as QueryInterface,
  storage: new SequelizeStorage({ sequelize, tableName: 'sequelize_meta' }),
  logger: console,
});
