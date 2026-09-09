import path from 'path';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

// Look for .env in root or backend/.env across dev and compiled production environments
const envSearchDirs = [
  process.cwd(),
  path.resolve(process.cwd(), 'backend'),
  path.resolve(__dirname, '../../..'),
  path.resolve(__dirname, '../../../backend'),
  path.resolve(__dirname, '../../../..'),
  path.resolve(__dirname, '../../../../backend'),
];
for (const dir of envSearchDirs) {
  dotenv.config({ path: path.join(dir, '.env') });
}

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_INTERNAL_URL;
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
const dbName = process.env.DB_NAME || 'blue_royal_hrms_dev';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const isSsl = process.env.DB_SSL === 'true' || (dbUrl !== undefined && dbUrl.includes('sslmode=require'));

const dialectOptions = isSsl
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
  : {};

export const sequelize = dbUrl
  ? new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
      dialectOptions,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    })
  : new Sequelize(dbName, dbUser, dbPassword, {
      host: dbHost,
      port: dbPort,
      dialect: 'postgres',
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
      dialectOptions,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    });
