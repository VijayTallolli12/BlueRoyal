import path from 'path';
import { pathToFileURL } from 'url';
import { Umzug, SequelizeStorage } from 'umzug';
import { QueryInterface } from 'sequelize';
import { sequelize } from './config/db';

const isCompiled = __filename.endsWith('.js');
const migrationGlob = isCompiled ? 'migrations/*.js' : 'migrations/*.ts';
const migrationCwd = path.resolve(__dirname, '..');

export const migrator = new Umzug({
  migrations: {
    glob: [migrationGlob, { cwd: migrationCwd }],
    resolve: ({ name, path: migrationPath, context }) => {
      // Normalize migration name to ensure seamless compatibility with sequelize_meta:
      // whether discovered as .js in production or .ts in dev, recorded name remains .ts.
      const normalizedName = name.replace(/\.js$/, '.ts');
      return {
        name: normalizedName,
        path: migrationPath,
        up: async () => {
          if (!migrationPath) throw new Error(`Missing migration path for ${name}`);
          const importUrl = pathToFileURL(migrationPath).href;
          const migration = await import(importUrl);
          const upFn = migration.up || migration.default?.up;
          if (typeof upFn !== 'function') {
            throw new Error(`Migration ${name} does not export an up() function`);
          }
          return upFn(context);
        },
        down: async () => {
          if (!migrationPath) throw new Error(`Missing migration path for ${name}`);
          const importUrl = pathToFileURL(migrationPath).href;
          const migration = await import(importUrl);
          const downFn = migration.down || migration.default?.down;
          if (typeof downFn !== 'function') {
            throw new Error(`Migration ${name} does not export a down() function`);
          }
          return downFn(context);
        },
      };
    },
  },
  context: sequelize.getQueryInterface() as QueryInterface,
  storage: new SequelizeStorage({ sequelize, tableName: 'sequelize_meta' }),
  logger: console,
});
