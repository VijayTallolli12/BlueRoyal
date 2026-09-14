import bcrypt from 'bcryptjs';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/db';

const { Client } = require('pg') as {
  Client: new (config?: Record<string, unknown>) => SeedTransferClient;
};

type SeedTransferClient = {
  connect: () => Promise<void>;
  query: <T = Record<string, unknown>>(sql: string) => Promise<{ rows: T[] }>;
  end: () => Promise<void>;
};

const RAW_PG_TIMEOUT_MS = 30000;

function buildSeedTransferClientConfig() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_INTERNAL_URL;
  const sslEnabled = process.env.DB_SSL === 'true' || Boolean(databaseUrl && databaseUrl.includes('sslmode=require'));

  const sslConfig = sslEnabled
    ? {
        rejectUnauthorized: false,
      }
    : false;

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: sslConfig,
      statement_timeout: RAW_PG_TIMEOUT_MS,
      query_timeout: RAW_PG_TIMEOUT_MS,
      connectionTimeoutMillis: RAW_PG_TIMEOUT_MS,
      application_name: 'blue-royal-seed-transfer',
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'blue_royal_hrms_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: sslConfig,
    statement_timeout: RAW_PG_TIMEOUT_MS,
    query_timeout: RAW_PG_TIMEOUT_MS,
    connectionTimeoutMillis: RAW_PG_TIMEOUT_MS,
    application_name: 'blue-royal-seed-transfer',
  };
}

export async function connectSeedTransferClient(): Promise<SeedTransferClient> {
  const client = new Client(buildSeedTransferClientConfig());
  console.log('[seed-transfer] Attempting raw pg connection using dedicated client.');
  await client.connect();

  const authResult = await client.query<{ database: string; user: string; ssl_enabled: string | null }>(`
    SELECT
      current_database() AS database,
      current_user AS user,
      current_setting('ssl', true) AS ssl_enabled;
  `);

  const row = authResult.rows[0];
  const sslEnabled = row.ssl_enabled === 'on';
  console.log(
    `[seed-transfer] Connected to database=${row.database}, user=${row.user}, ssl_enabled=${sslEnabled}`,
  );

  return client;
}

export async function validateProductionTransferConnection(): Promise<{
  database: string;
  user: string;
  ssl_enabled: boolean;
  select_ok: boolean;
}> {
  const client = await connectSeedTransferClient();

  try {
    const authResult = await client.query<{ database: string; user: string; ssl_enabled: string | null }>(`
      SELECT
        current_database() AS database,
        current_user AS user,
        current_setting('ssl', true) AS ssl_enabled;
    `);

    const selectResult = await client.query<{ ok: number }>('SELECT 1 AS ok;');
    const row = authResult.rows[0];
    const result = {
      database: row.database,
      user: row.user,
      ssl_enabled: row.ssl_enabled === 'on',
      select_ok: selectResult.rows[0]?.ok === 1,
    };

    console.log('[seed-transfer] Read-only validation succeeded.');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await client.end();
    console.log('[seed-transfer] Raw pg client closed.');
  }
}

// ============================================================================
// CONSTANTS & DEMO DATA DEFINITIONS
// ============================================================================

const DEMO_ACCOUNTS = [
  {
    email: 'superadmin@blueroyal.com',
    roleName: 'super_admin' as const,
    firstName: 'Super',
    lastName: 'Admin',
    password: process.env.DEMO_SUPERADMIN_PASSWORD || 'SuperAdmin@2026!',
  },
  {
    email: 'hradmin@blueroyal.com',
    roleName: 'hr_admin' as const,
    firstName: 'HR',
    lastName: 'Admin',
    password: process.env.DEMO_HRADMIN_PASSWORD || 'HrAdmin@2026!',
  },
  {
    email: 'employee@blueroyal.com',
    roleName: 'employee' as const,
    firstName: 'Ahmed',
    lastName: 'Al Mansoori',
    password: process.env.DEMO_EMPLOYEE_PASSWORD || 'Employee@2026!',
  },
];

const CLIENTS_DATA = [
  {
    code: 'CLI-MASAOOD',
    name: 'Al Masaood Group',
    contactPerson: 'Robert Sterling',
    contactEmail: 'r.sterling@masaood.ae',
    contactPhone: '+971 2 642 4444',
    billingAddress: 'Masaood Tower, Hamdan Street, Abu Dhabi, UAE',
  },
  {
    code: 'CLI-EMAAR',
    name: 'Emaar Properties PJSC',
    contactPerson: 'Fatima Al Marri',
    contactEmail: 'f.almarri@emaar.ae',
    contactPhone: '+971 4 367 3333',
    billingAddress: 'Downtown Dubai Boulevard, Building 1, Dubai, UAE',
  },
  {
    code: 'CLI-DAMAC',
    name: 'DAMAC Properties PJSC',
    contactPerson: 'Zayd Al Hashimi',
    contactEmail: 'z.hashimi@damacgroup.com',
    contactPhone: '+971 4 373 1000',
    billingAddress: 'DAMAC Executive Heights, Barsha Heights, Dubai, UAE',
  },
  {
    code: 'CLI-ALDAR',
    name: 'Aldar Properties PJSC',
    contactPerson: 'Mariam Al Qubaisi',
    contactEmail: 'm.qubaisi@aldar.com',
    contactPhone: '+971 2 810 5555',
    billingAddress: 'Aldar HQ, Al Raha Beach, Abu Dhabi, UAE',
  },
  {
    code: 'CLI-BLUEROYAL',
    name: 'Blue Royal Partner Developments',
    contactPerson: 'Alexander Hayes',
    contactEmail: 'a.hayes@blueroyaldev.ae',
    contactPhone: '+971 4 888 7777',
    billingAddress: 'Business Bay Prime Tower, Level 28, Dubai, UAE',
  },
];

const PROJECTS_DATA = [
  // Al Masaood (2 projects)
  {
    clientCode: 'CLI-MASAOOD',
    code: 'PRJ-MASAOOD-01',
    name: 'Masaood Marine Operations',
    siteLocation: 'Mussafah Port, Sector M-12, Abu Dhabi',
    startDate: '2025-01-01',
  },
  {
    clientCode: 'CLI-MASAOOD',
    code: 'PRJ-MASAOOD-02',
    name: 'Masaood Industrial Logistics Park',
    siteLocation: 'ICAD Industrial Zone, Abu Dhabi',
    startDate: '2025-03-01',
  },
  // Emaar (2 projects)
  {
    clientCode: 'CLI-EMAAR',
    code: 'PRJ-EMAAR-01',
    name: 'Downtown Burj Residences Complex',
    siteLocation: 'Financial Centre Road, Downtown Dubai',
    startDate: '2025-01-15',
  },
  {
    clientCode: 'CLI-EMAAR',
    code: 'PRJ-EMAAR-02',
    name: 'Dubai Creek Harbour Horizon Towers',
    siteLocation: 'Ras Al Khor, Dubai Creek Harbour, Dubai',
    startDate: '2025-04-01',
  },
  // DAMAC (2 projects)
  {
    clientCode: 'CLI-DAMAC',
    code: 'PRJ-DAMAC-01',
    name: 'DAMAC Lagoons Phase 2 Infrastructure',
    siteLocation: 'Hessa Street, Dubailand, Dubai',
    startDate: '2025-02-01',
  },
  {
    clientCode: 'CLI-DAMAC',
    code: 'PRJ-DAMAC-02',
    name: 'DAMAC Hills Luxury Villas Sector 4',
    siteLocation: 'Al Qudra Road, Al Hebiah Third, Dubai',
    startDate: '2025-05-01',
  },
  // Aldar (2 projects)
  {
    clientCode: 'CLI-ALDAR',
    code: 'PRJ-ALDAR-01',
    name: 'Yas Bay Waterfront Development',
    siteLocation: 'Yas South Boulevard, Yas Island, Abu Dhabi',
    startDate: '2025-01-10',
  },
  {
    clientCode: 'CLI-ALDAR',
    code: 'PRJ-ALDAR-02',
    name: 'Saadiyat Cultural District Infrastructure',
    siteLocation: 'Saadiyat Cultural Marina, Saadiyat Island, Abu Dhabi',
    startDate: '2025-03-15',
  },
  // Blue Royal (2 projects)
  {
    clientCode: 'CLI-BLUEROYAL',
    code: 'PRJ-BLUEROYAL-01',
    name: 'Blue Royal Corporate Headquarters',
    siteLocation: 'Marasi Drive, Business Bay, Dubai',
    startDate: '2025-01-01',
  },
  {
    clientCode: 'CLI-BLUEROYAL',
    code: 'PRJ-BLUEROYAL-02',
    name: 'Blue Royal Smart Logistics Hub',
    siteLocation: 'Aviation District, Dubai South, Dubai',
    startDate: '2025-06-01',
  },
];

const DESIGNATIONS_CONFIG = [
  { code: 'DES-FOREMAN', title: 'Site Foreman', normalBillingRate: 65.0, otBillingRate: 85.0 },
  { code: 'DES-ENG', title: 'Site Engineer', normalBillingRate: 85.0, otBillingRate: 110.0 },
  { code: 'DES-ELEC', title: 'Electrician', normalBillingRate: 45.0, otBillingRate: 60.0 },
  { code: 'DES-PLUMB', title: 'Plumber', normalBillingRate: 45.0, otBillingRate: 60.0 },
  { code: 'DES-CARP', title: 'Carpenter', normalBillingRate: 42.0, otBillingRate: 55.0 },
  { code: 'DES-HELPER', title: 'General Helper', normalBillingRate: 30.0, otBillingRate: 40.0 },
];

interface EmployeeSeedDef {
  code: string;
  projectCode: string;
  desigCode: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  dob: string;
  nationality: string;
  email: string;
  phone: string;
  joiningDate: string;
  employmentType: 'full_time' | 'contract';
  remunerationBasis: 'salaried' | 'hourly';
  address: string;
  passportNumber: string;
  visaNumber: string;
  // Salaried compensation
  basic?: number;
  hra?: number;
  transport?: number;
  // Hourly compensation
  normalRate?: number;
  otRate?: number;
}

const EMPLOYEES_DATA: EmployeeSeedDef[] = [
  // PRJ-MASAOOD-01 (6 employees)
  {
    code: 'EMP-DEMO-001',
    projectCode: 'PRJ-MASAOOD-01',
    desigCode: 'DES-FOREMAN',
    firstName: 'Ahmed',
    lastName: 'Al Mansoori',
    gender: 'male',
    dob: '1990-05-15',
    nationality: 'Emirati',
    email: 'employee@blueroyal.com',
    phone: '+971 50 111 2001',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Al Bateen, Abu Dhabi, UAE',
    passportNumber: 'P10029381',
    visaNumber: '201/2024/99101',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-002',
    projectCode: 'PRJ-MASAOOD-01',
    desigCode: 'DES-ENG',
    firstName: 'Tariq',
    lastName: 'Mahmoud',
    gender: 'male',
    dob: '1988-08-22',
    nationality: 'Egyptian',
    email: 'tariq.mahmoud@blueroyal.com',
    phone: '+971 50 111 2002',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Electra Street, Abu Dhabi, UAE',
    passportNumber: 'A92817263',
    visaNumber: '201/2024/99102',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-003',
    projectCode: 'PRJ-MASAOOD-01',
    desigCode: 'DES-ELEC',
    firstName: 'Rajesh',
    lastName: 'Kumar',
    gender: 'male',
    dob: '1993-03-10',
    nationality: 'Indian',
    email: 'rajesh.kumar@blueroyal.com',
    phone: '+971 50 111 2003',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Mussafah Shabiya, Abu Dhabi, UAE',
    passportNumber: 'M81726354',
    visaNumber: '201/2024/99103',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-004',
    projectCode: 'PRJ-MASAOOD-01',
    desigCode: 'DES-PLUMB',
    firstName: 'Mohammad',
    lastName: 'Bilal',
    gender: 'male',
    dob: '1995-11-18',
    nationality: 'Pakistani',
    email: 'mohammad.bilal@blueroyal.com',
    phone: '+971 50 111 2004',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Mussafah Industrial, Abu Dhabi, UAE',
    passportNumber: 'B71625341',
    visaNumber: '201/2024/99104',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-005',
    projectCode: 'PRJ-MASAOOD-01',
    desigCode: 'DES-CARP',
    firstName: 'Noel',
    lastName: 'Santos',
    gender: 'male',
    dob: '1992-07-04',
    nationality: 'Filipino',
    email: 'noel.santos@blueroyal.com',
    phone: '+971 50 111 2005',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Tourist Club Area, Abu Dhabi, UAE',
    passportNumber: 'EC9281726',
    visaNumber: '201/2024/99105',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-006',
    projectCode: 'PRJ-MASAOOD-01',
    desigCode: 'DES-HELPER',
    firstName: 'Ramesh',
    lastName: 'Patel',
    gender: 'male',
    dob: '1997-09-28',
    nationality: 'Indian',
    email: 'ramesh.patel@blueroyal.com',
    phone: '+971 50 111 2006',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'ICAD Camp, Abu Dhabi, UAE',
    passportNumber: 'N19283746',
    visaNumber: '201/2024/99106',
    normalRate: 18.0,
    otRate: 25.0,
  },

  // PRJ-MASAOOD-02 (6 employees)
  {
    code: 'EMP-DEMO-007',
    projectCode: 'PRJ-MASAOOD-02',
    desigCode: 'DES-FOREMAN',
    firstName: 'Omar',
    lastName: 'Al Zaabi',
    gender: 'male',
    dob: '1989-12-05',
    nationality: 'Emirati',
    email: 'omar.alzaabi@blueroyal.com',
    phone: '+971 50 111 2007',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Khalifa City, Abu Dhabi, UAE',
    passportNumber: 'P20938471',
    visaNumber: '201/2024/99107',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-008',
    projectCode: 'PRJ-MASAOOD-02',
    desigCode: 'DES-ENG',
    firstName: 'David',
    lastName: 'Miller',
    gender: 'male',
    dob: '1985-04-14',
    nationality: 'British',
    email: 'david.miller@blueroyal.com',
    phone: '+971 50 111 2008',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Al Reem Island, Abu Dhabi, UAE',
    passportNumber: 'UK5928174',
    visaNumber: '201/2024/99108',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-009',
    projectCode: 'PRJ-MASAOOD-02',
    desigCode: 'DES-ELEC',
    firstName: 'Suresh',
    lastName: 'Nair',
    gender: 'male',
    dob: '1991-06-30',
    nationality: 'Indian',
    email: 'suresh.nair@blueroyal.com',
    phone: '+971 50 111 2009',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Mussafah Sector 10, Abu Dhabi, UAE',
    passportNumber: 'M29384716',
    visaNumber: '201/2024/99109',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-010',
    projectCode: 'PRJ-MASAOOD-02',
    desigCode: 'DES-PLUMB',
    firstName: 'Imran',
    lastName: 'Khan',
    gender: 'male',
    dob: '1994-02-17',
    nationality: 'Pakistani',
    email: 'imran.khan@blueroyal.com',
    phone: '+971 50 111 2010',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Mussafah Shabiya 12, Abu Dhabi, UAE',
    passportNumber: 'B82736451',
    visaNumber: '201/2024/99110',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-011',
    projectCode: 'PRJ-MASAOOD-02',
    desigCode: 'DES-CARP',
    firstName: 'Arnel',
    lastName: 'Cruz',
    gender: 'male',
    dob: '1993-10-12',
    nationality: 'Filipino',
    email: 'arnel.cruz@blueroyal.com',
    phone: '+971 50 111 2011',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Najda Street, Abu Dhabi, UAE',
    passportNumber: 'EC1827364',
    visaNumber: '201/2024/99111',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-012',
    projectCode: 'PRJ-MASAOOD-02',
    desigCode: 'DES-HELPER',
    firstName: 'Abdul',
    lastName: 'Rahman',
    gender: 'male',
    dob: '1996-05-20',
    nationality: 'Bangladeshi',
    email: 'abdul.rahman@blueroyal.com',
    phone: '+971 50 111 2012',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'ICAD Worker Village, Abu Dhabi, UAE',
    passportNumber: 'BD9182736',
    visaNumber: '201/2024/99112',
    normalRate: 18.0,
    otRate: 25.0,
  },

  // PRJ-EMAAR-01 (6 employees)
  {
    code: 'EMP-DEMO-013',
    projectCode: 'PRJ-EMAAR-01',
    desigCode: 'DES-FOREMAN',
    firstName: 'Khalid',
    lastName: 'Al Nuaimi',
    gender: 'male',
    dob: '1987-03-25',
    nationality: 'Emirati',
    email: 'khalid.nuaimi@blueroyal.com',
    phone: '+971 50 111 2013',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Jumeirah 1, Dubai, UAE',
    passportNumber: 'P39485726',
    visaNumber: '201/2024/99113',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-014',
    projectCode: 'PRJ-EMAAR-01',
    desigCode: 'DES-ENG',
    firstName: 'Ziad',
    lastName: 'Haddad',
    gender: 'male',
    dob: '1986-11-08',
    nationality: 'Lebanese',
    email: 'ziad.haddad@blueroyal.com',
    phone: '+971 50 111 2014',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Downtown Views II, Dubai, UAE',
    passportNumber: 'RL4928172',
    visaNumber: '201/2024/99114',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-015',
    projectCode: 'PRJ-EMAAR-01',
    desigCode: 'DES-ELEC',
    firstName: 'Vikram',
    lastName: 'Singh',
    gender: 'male',
    dob: '1992-01-19',
    nationality: 'Indian',
    email: 'vikram.singh@blueroyal.com',
    phone: '+971 50 111 2015',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Al Quoz Industrial 3, Dubai, UAE',
    passportNumber: 'M38475619',
    visaNumber: '201/2024/99115',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-016',
    projectCode: 'PRJ-EMAAR-01',
    desigCode: 'DES-PLUMB',
    firstName: 'Farhan',
    lastName: 'Ali',
    gender: 'male',
    dob: '1995-08-14',
    nationality: 'Pakistani',
    email: 'farhan.ali@blueroyal.com',
    phone: '+971 50 111 2016',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Al Quoz Industrial 4, Dubai, UAE',
    passportNumber: 'B48572619',
    visaNumber: '201/2024/99116',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-017',
    projectCode: 'PRJ-EMAAR-01',
    desigCode: 'DES-CARP',
    firstName: 'Mark',
    lastName: 'Bautista',
    gender: 'male',
    dob: '1994-04-23',
    nationality: 'Filipino',
    email: 'mark.bautista@blueroyal.com',
    phone: '+971 50 111 2017',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Satwa, Dubai, UAE',
    passportNumber: 'EC3847261',
    visaNumber: '201/2024/99117',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-018',
    projectCode: 'PRJ-EMAAR-01',
    desigCode: 'DES-HELPER',
    firstName: 'Manoj',
    lastName: 'Verma',
    gender: 'male',
    dob: '1998-12-02',
    nationality: 'Indian',
    email: 'manoj.verma@blueroyal.com',
    phone: '+971 50 111 2018',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Sonapur Camp 2, Muhaisnah, Dubai, UAE',
    passportNumber: 'N48572918',
    visaNumber: '201/2024/99118',
    normalRate: 18.0,
    otRate: 25.0,
  },

  // PRJ-EMAAR-02 (6 employees)
  {
    code: 'EMP-DEMO-019',
    projectCode: 'PRJ-EMAAR-02',
    desigCode: 'DES-FOREMAN',
    firstName: 'Saeed',
    lastName: 'Al Kaabi',
    gender: 'male',
    dob: '1988-07-16',
    nationality: 'Emirati',
    email: 'saeed.kaabi@blueroyal.com',
    phone: '+971 50 111 2019',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Al Warqa 2, Dubai, UAE',
    passportNumber: 'P48572619',
    visaNumber: '201/2024/99119',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-020',
    projectCode: 'PRJ-EMAAR-02',
    desigCode: 'DES-ENG',
    firstName: 'Karim',
    lastName: 'Mostafa',
    gender: 'male',
    dob: '1987-10-31',
    nationality: 'Egyptian',
    email: 'karim.mostafa@blueroyal.com',
    phone: '+971 50 111 2020',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Dubai Festival City, Dubai, UAE',
    passportNumber: 'A38472619',
    visaNumber: '201/2024/99120',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-021',
    projectCode: 'PRJ-EMAAR-02',
    desigCode: 'DES-ELEC',
    firstName: 'Anil',
    lastName: 'Sharma',
    gender: 'male',
    dob: '1993-05-11',
    nationality: 'Indian',
    email: 'anil.sharma@blueroyal.com',
    phone: '+971 50 111 2021',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Ras Al Khor Industrial 2, Dubai, UAE',
    passportNumber: 'M48572630',
    visaNumber: '201/2024/99121',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-022',
    projectCode: 'PRJ-EMAAR-02',
    desigCode: 'DES-PLUMB',
    firstName: 'Usman',
    lastName: 'Tariq',
    gender: 'male',
    dob: '1994-09-24',
    nationality: 'Pakistani',
    email: 'usman.tariq@blueroyal.com',
    phone: '+971 50 111 2022',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Al Qusais Industrial 1, Dubai, UAE',
    passportNumber: 'B39485720',
    visaNumber: '201/2024/99122',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-023',
    projectCode: 'PRJ-EMAAR-02',
    desigCode: 'DES-CARP',
    firstName: 'Christian',
    lastName: 'Reyes',
    gender: 'male',
    dob: '1992-12-14',
    nationality: 'Filipino',
    email: 'christian.reyes@blueroyal.com',
    phone: '+971 50 111 2023',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Karama, Dubai, UAE',
    passportNumber: 'EC4857291',
    visaNumber: '201/2024/99123',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-024',
    projectCode: 'PRJ-EMAAR-02',
    desigCode: 'DES-HELPER',
    firstName: 'Dinesh',
    lastName: 'Yadav',
    gender: 'male',
    dob: '1997-04-09',
    nationality: 'Indian',
    email: 'dinesh.yadav@blueroyal.com',
    phone: '+971 50 111 2024',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Muhaisnah 2, Dubai, UAE',
    passportNumber: 'N38472910',
    visaNumber: '201/2024/99124',
    normalRate: 18.0,
    otRate: 25.0,
  },

  // PRJ-DAMAC-01 (6 employees)
  {
    code: 'EMP-DEMO-025',
    projectCode: 'PRJ-DAMAC-01',
    desigCode: 'DES-FOREMAN',
    firstName: 'Hamad',
    lastName: 'Al Shamsi',
    gender: 'male',
    dob: '1990-02-28',
    nationality: 'Emirati',
    email: 'hamad.shamsi@blueroyal.com',
    phone: '+971 50 111 2025',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Mirdif, Dubai, UAE',
    passportNumber: 'P58472910',
    visaNumber: '201/2024/99125',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-026',
    projectCode: 'PRJ-DAMAC-01',
    desigCode: 'DES-ENG',
    firstName: 'Fadi',
    lastName: 'El Khoury',
    gender: 'male',
    dob: '1986-06-17',
    nationality: 'Lebanese',
    email: 'fadi.khoury@blueroyal.com',
    phone: '+971 50 111 2026',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Motor City, Dubai, UAE',
    passportNumber: 'RL5847291',
    visaNumber: '201/2024/99126',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-027',
    projectCode: 'PRJ-DAMAC-01',
    desigCode: 'DES-ELEC',
    firstName: 'Pradeep',
    lastName: 'Kumar',
    gender: 'male',
    dob: '1991-11-23',
    nationality: 'Indian',
    email: 'pradeep.kumar@blueroyal.com',
    phone: '+971 50 111 2027',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Al Quoz Industrial 1, Dubai, UAE',
    passportNumber: 'M58472911',
    visaNumber: '201/2024/99127',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-028',
    projectCode: 'PRJ-DAMAC-01',
    desigCode: 'DES-PLUMB',
    firstName: 'Asif',
    lastName: 'Mahmood',
    gender: 'male',
    dob: '1993-08-05',
    nationality: 'Pakistani',
    email: 'asif.mahmood@blueroyal.com',
    phone: '+971 50 111 2028',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Al Quoz Industrial 2, Dubai, UAE',
    passportNumber: 'B58472912',
    visaNumber: '201/2024/99128',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-029',
    projectCode: 'PRJ-DAMAC-01',
    desigCode: 'DES-CARP',
    firstName: 'Jeffrey',
    lastName: 'Ramos',
    gender: 'male',
    dob: '1995-01-27',
    nationality: 'Filipino',
    email: 'jeffrey.ramos@blueroyal.com',
    phone: '+971 50 111 2029',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Al Barsha 1, Dubai, UAE',
    passportNumber: 'EC5847292',
    visaNumber: '201/2024/99129',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-030',
    projectCode: 'PRJ-DAMAC-01',
    desigCode: 'DES-HELPER',
    firstName: 'Sunil',
    lastName: 'Prasad',
    gender: 'male',
    dob: '1998-03-15',
    nationality: 'Indian',
    email: 'sunil.prasad@blueroyal.com',
    phone: '+971 50 111 2030',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Jebel Ali Industrial Area, Dubai, UAE',
    passportNumber: 'N58472913',
    visaNumber: '201/2024/99130',
    normalRate: 18.0,
    otRate: 25.0,
  },

  // PRJ-DAMAC-02 (6 employees)
  {
    code: 'EMP-DEMO-031',
    projectCode: 'PRJ-DAMAC-02',
    desigCode: 'DES-FOREMAN',
    firstName: 'Sultan',
    lastName: 'Al Marzooqi',
    gender: 'male',
    dob: '1989-09-12',
    nationality: 'Emirati',
    email: 'sultan.marzooqi@blueroyal.com',
    phone: '+971 50 111 2031',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Nad Al Sheba, Dubai, UAE',
    passportNumber: 'P68472911',
    visaNumber: '201/2024/99131',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-032',
    projectCode: 'PRJ-DAMAC-02',
    desigCode: 'DES-ENG',
    firstName: 'Richard',
    lastName: 'Taylor',
    gender: 'male',
    dob: '1984-12-20',
    nationality: 'British',
    email: 'richard.taylor@blueroyal.com',
    phone: '+971 50 111 2032',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Dubai Hills Estate, Dubai, UAE',
    passportNumber: 'UK6847292',
    visaNumber: '201/2024/99132',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-033',
    projectCode: 'PRJ-DAMAC-02',
    desigCode: 'DES-ELEC',
    firstName: 'Deepak',
    lastName: 'Joshi',
    gender: 'male',
    dob: '1992-04-18',
    nationality: 'Indian',
    email: 'deepak.joshi@blueroyal.com',
    phone: '+971 50 111 2033',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Al Quoz Industrial 3, Dubai, UAE',
    passportNumber: 'M68472912',
    visaNumber: '201/2024/99133',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-034',
    projectCode: 'PRJ-DAMAC-02',
    desigCode: 'DES-PLUMB',
    firstName: 'Shahbaz',
    lastName: 'Ahmed',
    gender: 'male',
    dob: '1994-07-29',
    nationality: 'Pakistani',
    email: 'shahbaz.ahmed@blueroyal.com',
    phone: '+971 50 111 2034',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Jebel Ali Camp, Dubai, UAE',
    passportNumber: 'B68472913',
    visaNumber: '201/2024/99134',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-035',
    projectCode: 'PRJ-DAMAC-02',
    desigCode: 'DES-CARP',
    firstName: 'Paolo',
    lastName: 'Mendoza',
    gender: 'male',
    dob: '1993-02-14',
    nationality: 'Filipino',
    email: 'paolo.mendoza@blueroyal.com',
    phone: '+971 50 111 2035',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Discovery Gardens, Dubai, UAE',
    passportNumber: 'EC6847293',
    visaNumber: '201/2024/99135',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-036',
    projectCode: 'PRJ-DAMAC-02',
    desigCode: 'DES-HELPER',
    firstName: 'Ravi',
    lastName: 'Shankar',
    gender: 'male',
    dob: '1996-10-08',
    nationality: 'Indian',
    email: 'ravi.shankar@blueroyal.com',
    phone: '+971 50 111 2036',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Jebel Ali Camp 3, Dubai, UAE',
    passportNumber: 'N68472914',
    visaNumber: '201/2024/99136',
    normalRate: 18.0,
    otRate: 25.0,
  },

  // PRJ-ALDAR-01 (6 employees)
  {
    code: 'EMP-DEMO-037',
    projectCode: 'PRJ-ALDAR-01',
    desigCode: 'DES-FOREMAN',
    firstName: 'Rashid',
    lastName: 'Al Falasi',
    gender: 'male',
    dob: '1991-04-03',
    nationality: 'Emirati',
    email: 'rashid.falasi@blueroyal.com',
    phone: '+971 50 111 2037',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Al Bahia, Abu Dhabi, UAE',
    passportNumber: 'P78472912',
    visaNumber: '201/2024/99137',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-038',
    projectCode: 'PRJ-ALDAR-01',
    desigCode: 'DES-ENG',
    firstName: 'Samer',
    lastName: 'Nassar',
    gender: 'male',
    dob: '1988-01-26',
    nationality: 'Jordanian',
    email: 'samer.nassar@blueroyal.com',
    phone: '+971 50 111 2038',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Al Raha Gardens, Abu Dhabi, UAE',
    passportNumber: 'J78472913',
    visaNumber: '201/2024/99138',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-039',
    projectCode: 'PRJ-ALDAR-01',
    desigCode: 'DES-ELEC',
    firstName: 'Gopalakrishnan',
    lastName: 'Ranganathan',
    gender: 'male',
    dob: '1990-08-15',
    nationality: 'Indian',
    email: 'gopal.rangan@blueroyal.com',
    phone: '+971 50 111 2039',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Mussafah Sector 11, Abu Dhabi, UAE',
    passportNumber: 'M78472914',
    visaNumber: '201/2024/99139',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-040',
    projectCode: 'PRJ-ALDAR-01',
    desigCode: 'DES-PLUMB',
    firstName: 'Naveed',
    lastName: 'Akhtar',
    gender: 'male',
    dob: '1993-11-04',
    nationality: 'Pakistani',
    email: 'naveed.akhtar@blueroyal.com',
    phone: '+971 50 111 2040',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Mussafah Shabiya 10, Abu Dhabi, UAE',
    passportNumber: 'B78472915',
    visaNumber: '201/2024/99140',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-041',
    projectCode: 'PRJ-ALDAR-01',
    desigCode: 'DES-CARP',
    firstName: 'Eduardo',
    lastName: 'Garcia',
    gender: 'male',
    dob: '1991-03-29',
    nationality: 'Filipino',
    email: 'eduardo.garcia@blueroyal.com',
    phone: '+971 50 111 2041',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Hamdan Street, Abu Dhabi, UAE',
    passportNumber: 'EC7847294',
    visaNumber: '201/2024/99141',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-042',
    projectCode: 'PRJ-ALDAR-01',
    desigCode: 'DES-HELPER',
    firstName: 'Amit',
    lastName: 'Chauhan',
    gender: 'male',
    dob: '1997-06-19',
    nationality: 'Indian',
    email: 'amit.chauhan@blueroyal.com',
    phone: '+971 50 111 2042',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'ICAD Camp, Abu Dhabi, UAE',
    passportNumber: 'N78472916',
    visaNumber: '201/2024/99142',
    normalRate: 18.0,
    otRate: 25.0,
  },

  // PRJ-ALDAR-02 (6 employees)
  {
    code: 'EMP-DEMO-043',
    projectCode: 'PRJ-ALDAR-02',
    desigCode: 'DES-FOREMAN',
    firstName: 'Mohammed',
    lastName: 'Al Suwaidi',
    gender: 'male',
    dob: '1987-12-11',
    nationality: 'Emirati',
    email: 'mohammed.suwaidi@blueroyal.com',
    phone: '+971 50 111 2043',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Al Karamah, Abu Dhabi, UAE',
    passportNumber: 'P88472913',
    visaNumber: '201/2024/99143',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-044',
    projectCode: 'PRJ-ALDAR-02',
    desigCode: 'DES-ENG',
    firstName: 'Philippe',
    lastName: 'Dubois',
    gender: 'male',
    dob: '1983-05-18',
    nationality: 'French',
    email: 'philippe.dubois@blueroyal.com',
    phone: '+971 50 111 2044',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Saadiyat Beach Residences, Abu Dhabi, UAE',
    passportNumber: 'FR8847294',
    visaNumber: '201/2024/99144',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-045',
    projectCode: 'PRJ-ALDAR-02',
    desigCode: 'DES-ELEC',
    firstName: 'Harish',
    lastName: 'Babu',
    gender: 'male',
    dob: '1992-09-07',
    nationality: 'Indian',
    email: 'harish.babu@blueroyal.com',
    phone: '+971 50 111 2045',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Mussafah Sector 12, Abu Dhabi, UAE',
    passportNumber: 'M88472915',
    visaNumber: '201/2024/99145',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-046',
    projectCode: 'PRJ-ALDAR-02',
    desigCode: 'DES-PLUMB',
    firstName: 'Kamran',
    lastName: 'Qureshi',
    gender: 'male',
    dob: '1994-01-22',
    nationality: 'Pakistani',
    email: 'kamran.qureshi@blueroyal.com',
    phone: '+971 50 111 2046',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Mussafah Sector 14, Abu Dhabi, UAE',
    passportNumber: 'B88472916',
    visaNumber: '201/2024/99146',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-047',
    projectCode: 'PRJ-ALDAR-02',
    desigCode: 'DES-CARP',
    firstName: 'Renato',
    lastName: 'Flores',
    gender: 'male',
    dob: '1990-11-13',
    nationality: 'Filipino',
    email: 'renato.flores@blueroyal.com',
    phone: '+971 50 111 2047',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Airport Road, Abu Dhabi, UAE',
    passportNumber: 'EC8847295',
    visaNumber: '201/2024/99147',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-048',
    projectCode: 'PRJ-ALDAR-02',
    desigCode: 'DES-HELPER',
    firstName: 'Sanjay',
    lastName: 'Gupta',
    gender: 'male',
    dob: '1996-08-30',
    nationality: 'Indian',
    email: 'sanjay.gupta@blueroyal.com',
    phone: '+971 50 111 2048',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'ICAD Worker City, Abu Dhabi, UAE',
    passportNumber: 'N88472917',
    visaNumber: '201/2024/99148',
    normalRate: 18.0,
    otRate: 25.0,
  },

  // PRJ-BLUEROYAL-01 (6 employees)
  {
    code: 'EMP-DEMO-049',
    projectCode: 'PRJ-BLUEROYAL-01',
    desigCode: 'DES-FOREMAN',
    firstName: 'Mansoor',
    lastName: 'Al Blooshi',
    gender: 'male',
    dob: '1988-06-04',
    nationality: 'Emirati',
    email: 'mansoor.blooshi@blueroyal.com',
    phone: '+971 50 111 2049',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Al Safa, Dubai, UAE',
    passportNumber: 'P98472914',
    visaNumber: '201/2024/99149',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-050',
    projectCode: 'PRJ-BLUEROYAL-01',
    desigCode: 'DES-ENG',
    firstName: 'Hany',
    lastName: 'El Sayed',
    gender: 'male',
    dob: '1985-09-25',
    nationality: 'Egyptian',
    email: 'hany.elsayed@blueroyal.com',
    phone: '+971 50 111 2050',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Bay Square 7, Business Bay, Dubai, UAE',
    passportNumber: 'A98472915',
    visaNumber: '201/2024/99150',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-051',
    projectCode: 'PRJ-BLUEROYAL-01',
    desigCode: 'DES-ELEC',
    firstName: 'Karthik',
    lastName: 'Natarajan',
    gender: 'male',
    dob: '1993-01-15',
    nationality: 'Indian',
    email: 'karthik.natarajan@blueroyal.com',
    phone: '+971 50 111 2051',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Al Quoz Industrial 1, Dubai, UAE',
    passportNumber: 'M98472916',
    visaNumber: '201/2024/99151',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-052',
    projectCode: 'PRJ-BLUEROYAL-01',
    desigCode: 'DES-PLUMB',
    firstName: 'Wasim',
    lastName: 'Akram',
    gender: 'male',
    dob: '1995-04-02',
    nationality: 'Pakistani',
    email: 'wasim.akram@blueroyal.com',
    phone: '+971 50 111 2052',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Al Quoz Industrial 2, Dubai, UAE',
    passportNumber: 'B98472917',
    visaNumber: '201/2024/99152',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-053',
    projectCode: 'PRJ-BLUEROYAL-01',
    desigCode: 'DES-CARP',
    firstName: 'Angelo',
    lastName: 'De Leon',
    gender: 'male',
    dob: '1992-08-20',
    nationality: 'Filipino',
    email: 'angelo.deleon@blueroyal.com',
    phone: '+971 50 111 2053',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Al Mankhool, Bur Dubai, Dubai, UAE',
    passportNumber: 'EC9847296',
    visaNumber: '201/2024/99153',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-054',
    projectCode: 'PRJ-BLUEROYAL-01',
    desigCode: 'DES-HELPER',
    firstName: 'Ajay',
    lastName: 'Tiwari',
    gender: 'male',
    dob: '1997-11-12',
    nationality: 'Indian',
    email: 'ajay.tiwari@blueroyal.com',
    phone: '+971 50 111 2054',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Muhaisnah 2 Camp, Dubai, UAE',
    passportNumber: 'N98472918',
    visaNumber: '201/2024/99154',
    normalRate: 18.0,
    otRate: 25.0,
  },

  // PRJ-BLUEROYAL-02 (6 employees)
  {
    code: 'EMP-DEMO-055',
    projectCode: 'PRJ-BLUEROYAL-02',
    desigCode: 'DES-FOREMAN',
    firstName: 'Salem',
    lastName: 'Al Dhaheri',
    gender: 'male',
    dob: '1990-10-18',
    nationality: 'Emirati',
    email: 'salem.dhaheri@blueroyal.com',
    phone: '+971 50 111 2055',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Al Barsha South, Dubai, UAE',
    passportNumber: 'P08472915',
    visaNumber: '201/2024/99155',
    basic: 5000,
    hra: 2000,
    transport: 1000,
  },
  {
    code: 'EMP-DEMO-056',
    projectCode: 'PRJ-BLUEROYAL-02',
    desigCode: 'DES-ENG',
    firstName: 'Patrick',
    lastName: "O'Connor",
    gender: 'male',
    dob: '1986-03-05',
    nationality: 'Irish',
    email: 'patrick.oconnor@blueroyal.com',
    phone: '+971 50 111 2056',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'salaried',
    address: 'Dubai South Pulse Residence, Dubai, UAE',
    passportNumber: 'IR0847296',
    visaNumber: '201/2024/99156',
    basic: 8000,
    hra: 3500,
    transport: 1500,
  },
  {
    code: 'EMP-DEMO-057',
    projectCode: 'PRJ-BLUEROYAL-02',
    desigCode: 'DES-ELEC',
    firstName: 'Venkat',
    lastName: 'Raman',
    gender: 'male',
    dob: '1991-07-22',
    nationality: 'Indian',
    email: 'venkat.raman@blueroyal.com',
    phone: '+971 50 111 2057',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Dubai Investment Park 1, Dubai, UAE',
    passportNumber: 'M08472917',
    visaNumber: '201/2024/99157',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-058',
    projectCode: 'PRJ-BLUEROYAL-02',
    desigCode: 'DES-PLUMB',
    firstName: 'Zubair',
    lastName: 'Shah',
    gender: 'male',
    dob: '1993-12-09',
    nationality: 'Pakistani',
    email: 'zubair.shah@blueroyal.com',
    phone: '+971 50 111 2058',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Dubai Investment Park 2, Dubai, UAE',
    passportNumber: 'B08472918',
    visaNumber: '201/2024/99158',
    normalRate: 25.0,
    otRate: 35.0,
  },
  {
    code: 'EMP-DEMO-059',
    projectCode: 'PRJ-BLUEROYAL-02',
    desigCode: 'DES-CARP',
    firstName: 'Gabriel',
    lastName: 'Santos',
    gender: 'male',
    dob: '1994-05-16',
    nationality: 'Filipino',
    email: 'gabriel.santos@blueroyal.com',
    phone: '+971 50 111 2059',
    joiningDate: '2025-01-01',
    employmentType: 'contract',
    remunerationBasis: 'hourly',
    address: 'Al Furjan, Dubai, UAE',
    passportNumber: 'EC0847297',
    visaNumber: '201/2024/99159',
    normalRate: 24.0,
    otRate: 33.0,
  },
  {
    code: 'EMP-DEMO-060',
    projectCode: 'PRJ-BLUEROYAL-02',
    desigCode: 'DES-HELPER',
    firstName: 'Vijay',
    lastName: 'Chawla',
    gender: 'male',
    dob: '1998-02-11',
    nationality: 'Indian',
    email: 'vijay.chawla@blueroyal.com',
    phone: '+971 50 111 2060',
    joiningDate: '2025-01-01',
    employmentType: 'full_time',
    remunerationBasis: 'hourly',
    address: 'Dubai South Worker Village, Dubai, UAE',
    passportNumber: 'N08472919',
    visaNumber: '201/2024/99160',
    normalRate: 18.0,
    otRate: 25.0,
  },
];

// Helper to round currency/rates
function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// Generate date range string array 'YYYY-MM-DD'
function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const curr = new Date(startDateStr);
  const end = new Date(endDateStr);
  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

export async function seedDemoUsers(): Promise<Record<string, { role: string; email: string; password: string }>> {
  console.log('\n================================================================');
  console.log('   Blue Royal HRMS — Fresh Production Demo Seeder Engine        ');
  console.log('================================================================\n');

  const credentialsOutput: Record<string, { role: string; email: string; password: string }> = {};

  try {
    await sequelize.authenticate();
    console.log('✓ Database connection authenticated successfully.');

    // --------------------------------------------------------------------------
    // 1. SAFE DATA RESET SEQUENCE (Child-to-Parent in strict FK order)
    // --------------------------------------------------------------------------
    console.log('\n--- Step 1: Clearing existing operational business & demo data ---');
    await sequelize.query(`
      DELETE FROM invoice_payment_allocations;
      DELETE FROM client_payments;
      DELETE FROM client_invoice_lines;
      DELETE FROM client_invoices;
      DELETE FROM payroll_item_lines;
      DELETE FROM payroll_items;
      DELETE FROM payroll_periods;
      DELETE FROM attendance_audit_logs;
      DELETE FROM attendance_records;
      DELETE FROM attendance_periods;
      DELETE FROM leave_requests;
      DELETE FROM employee_leave_balances;
      DELETE FROM employee_onboardings;
      DELETE FROM employee_documents;
      DELETE FROM employee_salary_structures;
      DELETE FROM employee_hourly_rates;
      DELETE FROM client_billing_rates;
      DELETE FROM employee_shift_assignments;
      DELETE FROM employee_assignments;
      DELETE FROM projects;
      DELETE FROM clients;

      -- Safely clear phase 6 separation tables before deleting employees
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settlement_adjustment_lines') THEN
          DELETE FROM settlement_adjustment_lines;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'final_settlements') THEN
          DELETE FROM final_settlements;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'department_clearances') THEN
          DELETE FROM department_clearances;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_separations') THEN
          DELETE FROM employee_separations;
        END IF;
      END $$;

      DELETE FROM employees;
    `);

    // Clean up demo users from users table
    await sequelize.query(`
      DELETE FROM user_roles WHERE user_id IN (
        SELECT id FROM users WHERE email IN ('superadmin@blueroyal.com', 'hradmin@blueroyal.com', 'employee@blueroyal.com')
      );
      DELETE FROM users WHERE email IN ('superadmin@blueroyal.com', 'hradmin@blueroyal.com', 'employee@blueroyal.com');
      DELETE FROM users WHERE email LIKE '%@blueroyal.local';
    `);
    console.log('✓ Business & demo data cleared cleanly.');

    // --------------------------------------------------------------------------
    // 2. SEED DEMO USERS & ROLES
    // --------------------------------------------------------------------------
    console.log('\n--- Step 2: Seeding Demo Users & Assigning Roles ---');
    const roles = await sequelize.query<{ id: string; name: string }>(
      'SELECT id, name FROM roles;',
      { type: QueryTypes.SELECT },
    );
    const roleMap = new Map<string, string>();
    for (const r of roles) roleMap.set(r.name, r.id);

    const userMap = new Map<string, string>();

    for (const acc of DEMO_ACCOUNTS) {
      const roleId = roleMap.get(acc.roleName);
      if (!roleId) throw new Error(`Role ${acc.roleName} not found.`);

      const hash = await bcrypt.hash(acc.password, 12);
      const [u] = await sequelize.query<{ id: string }>(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :email, :hash, :firstName, :lastName, true, NOW(), NOW())
         RETURNING id;`,
        {
          replacements: { email: acc.email, hash, firstName: acc.firstName, lastName: acc.lastName },
          type: QueryTypes.SELECT,
        },
      );
      userMap.set(acc.email, u.id);

      // Note: user_roles has NO updated_at column
      await sequelize.query(
        `INSERT INTO user_roles (user_id, role_id, created_at)
         VALUES (:userId, :roleId, NOW())
         ON CONFLICT DO NOTHING;`,
        { replacements: { userId: u.id, roleId }, type: QueryTypes.RAW },
      );

      // Super admin gets all permissions mapped
      if (acc.roleName === 'super_admin') {
        await sequelize.query(
          `INSERT INTO role_permissions (role_id, permission_id, created_at)
           SELECT :roleId, p.id, NOW()
           FROM permissions p
           ON CONFLICT DO NOTHING;`,
          { replacements: { roleId }, type: QueryTypes.RAW },
        );
      }

      credentialsOutput[acc.roleName] = {
        role: acc.roleName,
        email: acc.email,
        password: acc.password,
      };
    }
    console.log('✓ 3 demo accounts (super_admin, hr_admin, employee) configured.');

    const superAdminUserId = userMap.get('superadmin@blueroyal.com')!;
    const hrAdminUserId = userMap.get('hradmin@blueroyal.com')!;
    const employeeUserId = userMap.get('employee@blueroyal.com')!;

    // --------------------------------------------------------------------------
    // 3. SEED 5 COMMERCIAL CLIENTS
    // --------------------------------------------------------------------------
    console.log('\n--- Step 3: Seeding 5 Commercial Clients ---');
    const clientMap = new Map<string, string>(); // code -> id

    for (const c of CLIENTS_DATA) {
      const [row] = await sequelize.query<{ id: string }>(
        `INSERT INTO clients (id, code, name, contact_person, contact_email, contact_phone, billing_address, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :code, :name, :contactPerson, :contactEmail, :contactPhone, :billingAddress, true, NOW(), NOW())
         RETURNING id;`,
        { replacements: c, type: QueryTypes.SELECT },
      );
      clientMap.set(c.code, row.id);
    }
    console.log(`✓ 5 clients seeded: ${Array.from(clientMap.keys()).join(', ')}`);

    // --------------------------------------------------------------------------
    // 4. SEED 10 PROJECTS (2 PER CLIENT)
    // --------------------------------------------------------------------------
    console.log('\n--- Step 4: Seeding 10 Projects (2 per Client) ---');
    const projectMap = new Map<string, string>(); // code -> id

    for (const p of PROJECTS_DATA) {
      const clientId = clientMap.get(p.clientCode)!;
      const [row] = await sequelize.query<{ id: string }>(
        `INSERT INTO projects (id, client_id, code, name, site_location, start_date, status, created_at, updated_at)
         VALUES (gen_random_uuid(), :clientId, :code, :name, :siteLocation, :startDate, 'active', NOW(), NOW())
         RETURNING id;`,
        { replacements: { clientId, ...p }, type: QueryTypes.SELECT },
      );
      projectMap.set(p.code, row.id);
    }
    console.log(`✓ 10 projects seeded: ${Array.from(projectMap.keys()).join(', ')}`);

    // --------------------------------------------------------------------------
    // 5. SEED / RESOLVE DESIGNATIONS & BILLING RATES (6 PER PROJECT = 60 RATES)
    // --------------------------------------------------------------------------
    console.log('\n--- Step 5: Seeding 6 Designations & 60 Project Billing Rates ---');
    const desigMap = new Map<string, string>(); // code -> id

    for (const d of DESIGNATIONS_CONFIG) {
      const existing = await sequelize.query<{ id: string }>(
        'SELECT id FROM designations WHERE code = :code;',
        { replacements: { code: d.code }, type: QueryTypes.SELECT },
      );
      let desigId: string;
      if (existing.length === 0) {
        const [row] = await sequelize.query<{ id: string }>(
          `INSERT INTO designations (id, code, title, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), :code, :title, true, NOW(), NOW())
           RETURNING id;`,
          { replacements: { code: d.code, title: d.title }, type: QueryTypes.SELECT },
        );
        desigId = row.id;
      } else {
        desigId = existing[0].id;
      }
      desigMap.set(d.code, desigId);
    }

    // Configure client billing rates for every project & designation
    for (const p of PROJECTS_DATA) {
      const clientId = clientMap.get(p.clientCode)!;
      const projectId = projectMap.get(p.code)!;

      for (const d of DESIGNATIONS_CONFIG) {
        const designationId = desigMap.get(d.code)!;
        await sequelize.query(
          `INSERT INTO client_billing_rates (
             id, client_id, project_id, designation_id, normal_billing_rate, ot_billing_rate,
             effective_from, effective_to, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), :clientId, :projectId, :designationId, :normalBillingRate, :otBillingRate,
             '2025-01-01', NULL, NOW(), NOW()
           );`,
          {
            replacements: {
              clientId,
              projectId,
              designationId,
              normalBillingRate: d.normalBillingRate,
              otBillingRate: d.otBillingRate,
            },
            type: QueryTypes.RAW,
          },
        );
      }
    }
    console.log('✓ 6 designations verified and 60 project billing rates configured.');

    // --------------------------------------------------------------------------
    // 6. ENSURE STANDARD WORK SHIFT
    // --------------------------------------------------------------------------
    console.log('\n--- Step 6: Ensuring Standard Work Shift ---');
    let standardShiftId: string;
    const existingShift = await sequelize.query<{ id: string }>(
      "SELECT id FROM shifts WHERE code = 'SH-STANDARD';",
      { type: QueryTypes.SELECT },
    );
    if (existingShift.length === 0) {
      const [row] = await sequelize.query<{ id: string }>(
        `INSERT INTO shifts (id, code, name, start_time, end_time, break_minutes, work_hours, is_night_shift, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), 'SH-STANDARD', 'Standard Day Shift (08:00 - 17:00)', '08:00:00', '17:00:00', 60, 8.00, false, true, NOW(), NOW())
         RETURNING id;`,
        { type: QueryTypes.SELECT },
      );
      standardShiftId = row.id;
    } else {
      standardShiftId = existingShift[0].id;
    }
    console.log(`✓ Shift verified: SH-STANDARD (${standardShiftId})`);

    // --------------------------------------------------------------------------
    // 7. RESOLVE SALARY COMPONENTS, LEAVE TYPES & DOCUMENT TYPES
    // --------------------------------------------------------------------------
    console.log('\n--- Step 7: Resolving Master Catalogs ---');
    const salaryComponents = await sequelize.query<{ id: string; code: string }>(
      'SELECT id, code FROM salary_components;',
      { type: QueryTypes.SELECT },
    );
    const salaryComponentMap = new Map<string, string>();
    for (const sc of salaryComponents) salaryComponentMap.set(sc.code, sc.id);

    const leaveTypes = await sequelize.query<{ id: string; code: string }>(
      'SELECT id, code FROM leave_types;',
      { type: QueryTypes.SELECT },
    );
    const leaveTypeMap = new Map<string, string>();
    for (const lt of leaveTypes) leaveTypeMap.set(lt.code, lt.id);

    const documentTypes = await sequelize.query<{ id: string; code: string }>(
      'SELECT id, code FROM document_types;',
      { type: QueryTypes.SELECT },
    );
    const docTypeMap = new Map<string, string>();
    for (const dt of documentTypes) docTypeMap.set(dt.code, dt.id);

    const passportDocTypeId = docTypeMap.get('PASSPORT') || 'a0000001-0000-0000-0000-000000000001';
    const visaDocTypeId = docTypeMap.get('VISA') || 'a0000001-0000-0000-0000-000000000002';

    // --------------------------------------------------------------------------
    // 8. SEED 60 REALISTIC EMPLOYEES & ASSOCIATED RECORDS
    // --------------------------------------------------------------------------
    console.log('\n--- Step 8: Seeding 60 Employees & Comprehensive Profiles ---');
    const empIdMap = new Map<string, string>(); // code -> id

    for (const emp of EMPLOYEES_DATA) {
      const linkedUserId = emp.code === 'EMP-DEMO-001' ? employeeUserId : null;
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        `${emp.firstName}+${emp.lastName}`,
      )}&background=0284c7&color=ffffff&size=256&bold=true`;

      const [row] = await sequelize.query<{ id: string }>(
        `INSERT INTO employees (
           id, employee_code, user_id, first_name, last_name, gender, date_of_birth,
           nationality, email, phone_number, date_of_joining, status, employment_type,
           remuneration_basis, address, country, profile_photo, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :code, :linkedUserId, :firstName, :lastName, :gender, :dob,
           :nationality, :email, :phone, :joiningDate, 'active', :employmentType,
           :remunerationBasis, :address, 'United Arab Emirates', :avatarUrl, NOW(), NOW()
         ) RETURNING id;`,
        {
          replacements: {
            code: emp.code,
            linkedUserId,
            firstName: emp.firstName,
            lastName: emp.lastName,
            gender: emp.gender,
            dob: emp.dob,
            nationality: emp.nationality,
            email: emp.email,
            phone: emp.phone,
            joiningDate: emp.joiningDate,
            employmentType: emp.employmentType,
            remunerationBasis: emp.remunerationBasis,
            address: emp.address,
            avatarUrl,
          },
          type: QueryTypes.SELECT,
        },
      );
      const empId = row.id;
      empIdMap.set(emp.code, empId);

      // 8a. Project Deployment Assignment
      const proj = PROJECTS_DATA.find((p) => p.code === emp.projectCode)!;
      const clientId = clientMap.get(proj.clientCode)!;
      const projectId = projectMap.get(emp.projectCode)!;
      const designationId = desigMap.get(emp.desigCode)!;

      await sequelize.query(
        `INSERT INTO employee_assignments (
           id, employee_id, client_id, project_id, designation_id, effective_from, effective_to, remarks, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :empId, :clientId, :projectId, :designationId, '2025-01-01', NULL, 'Initial site deployment', NOW(), NOW()
         );`,
        { replacements: { empId, clientId, projectId, designationId }, type: QueryTypes.RAW },
      );

      // 8b. Shift Assignment
      await sequelize.query(
        `INSERT INTO employee_shift_assignments (
           id, employee_id, shift_id, effective_from, effective_to, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :empId, :standardShiftId, '2025-01-01', NULL, NOW(), NOW()
         );`,
        { replacements: { empId, standardShiftId }, type: QueryTypes.RAW },
      );

      // 8c. Documents (Passport & Visa)
      await sequelize.query(
        `INSERT INTO employee_documents (
           id, employee_id, document_type_id, document_number, issue_date, expiry_date,
           file_name, file_path, mime_type, file_size_bytes, verification_status,
           verified_by_user_id, verified_at, is_active, created_at, updated_at
         ) VALUES
         (
           gen_random_uuid(), :empId, :passportDocTypeId, :passportNumber, '2023-01-15', '2030-01-14',
           'passport_scan.pdf', '/storage/documents/passports/' || :code || '.pdf', 'application/pdf', 1048576,
           'verified', :superAdminUserId, NOW(), true, NOW(), NOW()
         ),
         (
           gen_random_uuid(), :empId, :visaDocTypeId, :visaNumber, '2024-02-01', '2027-01-31',
           'employment_visa.pdf', '/storage/documents/visas/' || :code || '.pdf', 'application/pdf', 786432,
           'verified', :superAdminUserId, NOW(), true, NOW(), NOW()
         );`,
        {
          replacements: {
            empId,
            passportDocTypeId,
            passportNumber: emp.passportNumber,
            visaDocTypeId,
            visaNumber: emp.visaNumber,
            code: emp.code,
            superAdminUserId,
          },
          type: QueryTypes.RAW,
        },
      );

      // 8d. Remuneration: Hourly Rate or Salary Structure
      if (emp.remunerationBasis === 'hourly') {
        await sequelize.query(
          `INSERT INTO employee_hourly_rates (
             id, employee_id, normal_hourly_rate, ot_hourly_rate, effective_from, effective_to, change_reason, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), :empId, :normalRate, :otRate, '2025-01-01', NULL, 'Standard employment rate agreement', NOW(), NOW()
           );`,
          {
            replacements: {
              empId,
              normalRate: emp.normalRate || 25.0,
              otRate: emp.otRate || 35.0,
            },
            type: QueryTypes.RAW,
          },
        );
      } else {
        const basicId = salaryComponentMap.get('BASIC')!;
        const hraId = salaryComponentMap.get('HRA')!;
        const transportId = salaryComponentMap.get('TRANSPORT')!;

        await sequelize.query(
          `INSERT INTO employee_salary_structures (
             id, employee_id, component_id, amount_or_percentage, effective_from, effective_to, created_at, updated_at
           ) VALUES
           (gen_random_uuid(), :empId, :basicId, :basic, '2025-01-01', NULL, NOW(), NOW()),
           (gen_random_uuid(), :empId, :hraId, :hra, '2025-01-01', NULL, NOW(), NOW()),
           (gen_random_uuid(), :empId, :transportId, :transport, '2025-01-01', NULL, NOW(), NOW());`,
          {
            replacements: {
              empId,
              basicId,
              basic: emp.basic || 5000,
              hraId,
              hra: emp.hra || 2000,
              transportId,
              transport: emp.transport || 1000,
            },
            type: QueryTypes.RAW,
          },
        );
      }

      // 8e. Leave Balances for 2026
      const annualLeaveId = leaveTypeMap.get('ANNUAL');
      const sickLeaveId = leaveTypeMap.get('SICK');
      const emergencyLeaveId = leaveTypeMap.get('EMERGENCY');

      if (annualLeaveId && sickLeaveId && emergencyLeaveId) {
        await sequelize.query(
          `INSERT INTO employee_leave_balances (
             id, employee_id, leave_type_id, year, allocated_days, used_days, pending_days, carried_forward, created_at, updated_at
           ) VALUES
           (gen_random_uuid(), :empId, :annualLeaveId, 2026, 30.0, 2.0, 0.0, 0.0, NOW(), NOW()),
           (gen_random_uuid(), :empId, :sickLeaveId, 2026, 15.0, 1.0, 0.0, 0.0, NOW(), NOW()),
           (gen_random_uuid(), :empId, :emergencyLeaveId, 2026, 5.0, 0.0, 0.0, 0.0, NOW(), NOW());`,
          { replacements: { empId, annualLeaveId, sickLeaveId, emergencyLeaveId }, type: QueryTypes.RAW },
        );
      }
    }
    console.log(`✓ 60 employees seeded with documents, assignments, remuneration & leave balances.`);

    // --------------------------------------------------------------------------
    // 9. SEED ATTENDANCE PERIODS & RECORDS (JUNE, JULY, AUGUST + SEPT 1–11, 2026)
    // --------------------------------------------------------------------------
    console.log('\n--- Step 9: Seeding Attendance Periods & Daily Records ---');
    const periodConfigs = [
      { code: '2026-06', name: 'June 2026', startDate: '2026-06-01', endDate: '2026-06-30', status: 'locked' },
      { code: '2026-07', name: 'July 2026', startDate: '2026-07-01', endDate: '2026-07-31', status: 'locked' },
      { code: '2026-08', name: 'August 2026', startDate: '2026-08-01', endDate: '2026-08-31', status: 'locked' },
      { code: '2026-09', name: 'September 2026', startDate: '2026-09-01', endDate: '2026-09-30', status: 'draft' },
    ];

    const attendancePeriodMap = new Map<string, string>(); // code -> id

    for (const p of periodConfigs) {
      const [row] = await sequelize.query<{ id: string }>(
        `INSERT INTO attendance_periods (
           id, period_code, name, start_date, end_date, status,
           submitted_by, submitted_at, approved_by, approved_at, locked_by, locked_at, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :code, :name, :startDate, :endDate, :status,
           :superAdminUserId, NOW(), :superAdminUserId, NOW(),
           ${p.status === 'locked' ? ':superAdminUserId' : 'NULL'},
           ${p.status === 'locked' ? 'NOW()' : 'NULL'},
           NOW(), NOW()
         ) RETURNING id;`,
        { replacements: { ...p, superAdminUserId }, type: QueryTypes.SELECT },
      );
      attendancePeriodMap.set(p.code, row.id);
    }

    // Generate daily records
    // June: 30 days
    // July: 31 days (July 17 is Islamic New Year holiday)
    // August: 31 days
    // September: Sept 1 to Sept 11 only!
    const monthsToSeed = [
      { code: '2026-06', start: '2026-06-01', end: '2026-06-30' },
      { code: '2026-07', start: '2026-07-01', end: '2026-07-31' },
      { code: '2026-08', start: '2026-08-01', end: '2026-08-31' },
      { code: '2026-09', start: '2026-09-01', end: '2026-09-11' }, // Strict Sept 1–11 only
    ];

    let totalAttendanceRecords = 0;

    for (const m of monthsToSeed) {
      const periodId = attendancePeriodMap.get(m.code)!;
      const dates = getDatesInRange(m.start, m.end);

      for (const emp of EMPLOYEES_DATA) {
        const empId = empIdMap.get(emp.code)!;
        const proj = PROJECTS_DATA.find((p) => p.code === emp.projectCode)!;
        const clientId = clientMap.get(proj.clientCode)!;
        const projectId = projectMap.get(emp.projectCode)!;
        const designationId = desigMap.get(emp.desigCode)!;

        // Deterministic daily record values
        const empNum = parseInt(emp.code.replace('EMP-DEMO-', ''), 10);

        for (const dStr of dates) {
          const d = new Date(dStr);
          const dayOfWeek = d.getUTCDay(); // 0 is Sunday

          let dayType = 'regular_workday';
          let actualHours = 8.0;
          let regularHours = 8.0;
          let otHours = 0.0;
          let isAbsent = false;
          let isOnLeave = false;

          if (dayOfWeek === 0) {
            // Sunday is weekend
            dayType = 'weekend';
            actualHours = 0.0;
            regularHours = 0.0;
            otHours = 0.0;
          } else if (dStr === '2026-07-17') {
            // UAE Islamic New Year Public Holiday
            dayType = 'public_holiday';
            actualHours = 0.0;
            regularHours = 0.0;
            otHours = 0.0;
          } else if (dStr === '2026-07-10' && (empNum === 3 || empNum === 15)) {
            // Occasional approved leave
            dayType = 'regular_workday';
            actualHours = 0.0;
            regularHours = 0.0;
            otHours = 0.0;
            isOnLeave = true;
          } else if (dStr === '2026-08-12' && (empNum === 8 || empNum === 22)) {
            // Occasional approved sick leave
            dayType = 'regular_workday';
            actualHours = 0.0;
            regularHours = 0.0;
            otHours = 0.0;
            isOnLeave = true;
          } else {
            // Regular working day: add 1-2 hours OT for hourly workers on Thursdays & Tuesdays
            if (emp.remunerationBasis === 'hourly' && (dayOfWeek === 2 || dayOfWeek === 4)) {
              const extraOt = (empNum + dayOfWeek) % 2 === 0 ? 2.0 : 1.0;
              otHours = extraOt;
              actualHours = round2(8.0 + extraOt);
            }
          }

          await sequelize.query(
            `INSERT INTO attendance_records (
               id, attendance_period_id, employee_id, work_date, client_id, project_id, designation_id, shift_id,
               day_type, actual_hours, regular_hours, ot_hours, is_absent, is_on_leave, has_anomaly, created_at, updated_at
             ) VALUES (
               gen_random_uuid(), :periodId, :empId, :dStr, :clientId, :projectId, :designationId, :standardShiftId,
               :dayType, :actualHours, :regularHours, :otHours, :isAbsent, :isOnLeave, false, NOW(), NOW()
             );`,
            {
              replacements: {
                periodId,
                empId,
                dStr,
                clientId,
                projectId,
                designationId,
                standardShiftId,
                dayType,
                actualHours,
                regularHours,
                otHours,
                isAbsent,
                isOnLeave,
              },
              type: QueryTypes.RAW,
            },
          );
          totalAttendanceRecords++;
        }
      }
    }
    console.log(`✓ Attendance seeded: ${totalAttendanceRecords} records across June, July, August and Sept 1–11.`);

    // --------------------------------------------------------------------------
    // 10. SEED SAMPLE LEAVE REQUESTS
    // --------------------------------------------------------------------------
    console.log('\n--- Step 10: Seeding Realistic Leave Requests ---');
    const annualLeaveId = leaveTypeMap.get('ANNUAL')!;
    const sickLeaveId = leaveTypeMap.get('SICK')!;

    const leaveRequestsData = [
      {
        reqNum: 'LR-2026-0001',
        empCode: 'EMP-DEMO-001',
        leaveTypeId: annualLeaveId,
        startDate: '2026-06-18',
        endDate: '2026-06-19',
        totalDays: 2.0,
        reason: 'Family visit during long weekend',
        status: 'APPROVED',
      },
      {
        reqNum: 'LR-2026-0002',
        empCode: 'EMP-DEMO-003',
        leaveTypeId: annualLeaveId,
        startDate: '2026-07-10',
        endDate: '2026-07-10',
        totalDays: 1.0,
        reason: 'Personal urgent appointment',
        status: 'APPROVED',
      },
      {
        reqNum: 'LR-2026-0003',
        empCode: 'EMP-DEMO-008',
        leaveTypeId: sickLeaveId,
        startDate: '2026-08-12',
        endDate: '2026-08-12',
        totalDays: 1.0,
        reason: 'Dental emergency procedure',
        status: 'APPROVED',
      },
      {
        reqNum: 'LR-2026-0004',
        empCode: 'EMP-DEMO-014',
        leaveTypeId: annualLeaveId,
        startDate: '2026-09-20',
        endDate: '2026-09-25',
        totalDays: 5.0,
        reason: 'Annual vacation trip to Beirut',
        status: 'PENDING',
      },
      {
        reqNum: 'LR-2026-0005',
        empCode: 'EMP-DEMO-020',
        leaveTypeId: annualLeaveId,
        startDate: '2026-09-15',
        endDate: '2026-09-18',
        totalDays: 4.0,
        reason: 'Personal travel',
        status: 'REJECTED',
      },
    ];

    for (const lr of leaveRequestsData) {
      const empId = empIdMap.get(lr.empCode)!;
      await sequelize.query(
        `INSERT INTO leave_requests (
           id, request_number, employee_id, leave_type_id, start_date, end_date, total_days,
           reason, status, approved_by, approved_at, rejection_reason, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :reqNum, :empId, :leaveTypeId, :startDate, :endDate, :totalDays,
           :reason, :status,
           ${lr.status === 'APPROVED' ? ':hrAdminUserId' : 'NULL'},
           ${lr.status === 'APPROVED' ? 'NOW()' : 'NULL'},
           ${lr.status === 'REJECTED' ? "'Operational staffing shortage on site'" : 'NULL'},
           NOW(), NOW()
         );`,
        { replacements: { ...lr, empId, hrAdminUserId }, type: QueryTypes.RAW },
      );
    }
    console.log('✓ Realistic leave requests seeded (Approved, Pending, Rejected).');

    // --------------------------------------------------------------------------
    // 11. SEED & FINALIZE PAYROLL FOR JULY AND AUGUST 2026 (60 EMPLOYEES EACH)
    // --------------------------------------------------------------------------
    console.log('\n--- Step 11: Seeding Finalized Payroll for July & August 2026 ---');
    const payrollMonths = [
      { code: 'PAY-2026-07', name: 'July 2026 Payroll', attCode: '2026-07', start: '2026-07-01', end: '2026-07-31' },
      { code: 'PAY-2026-08', name: 'August 2026 Payroll', attCode: '2026-08', start: '2026-08-01', end: '2026-08-31' },
    ];

    for (const pm of payrollMonths) {
      const attPeriodId = attendancePeriodMap.get(pm.attCode)!;

      // 1. Create payroll_periods record in draft
      const [pRow] = await sequelize.query<{ id: string }>(
        `INSERT INTO payroll_periods (
           id, period_code, name, start_date, end_date, attendance_period_id, status,
           total_gross_pay, total_deductions, total_net_pay, employee_count, blocking_issues_count,
           calculated_by, calculated_at, reviewed_by, reviewed_at, finalized_by, finalized_at, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :code, :name, :start, :end, :attPeriodId, 'finalized',
           0, 0, 0, 60, 0,
           :superAdminUserId, NOW(), :hrAdminUserId, NOW(), :superAdminUserId, NOW(), NOW(), NOW()
         ) RETURNING id;`,
        { replacements: { ...pm, attPeriodId, superAdminUserId, hrAdminUserId }, type: QueryTypes.SELECT },
      );
      const payrollPeriodId = pRow.id;

      let periodGrossTotal = 0;
      let periodDeductionsTotal = 0;

      // 2. Populate 60 payroll items and lines
      for (const emp of EMPLOYEES_DATA) {
        const empId = empIdMap.get(emp.code)!;
        const desigId = desigMap.get(emp.desigCode)!;

        // Fetch attendance stats for this month
        const attStats = await sequelize.query<{
          totalActual: string;
          totalRegular: string;
          totalOt: string;
          leaveDays: string;
          absentDays: string;
        }>(
          `SELECT
             COALESCE(SUM(actual_hours), 0) AS "totalActual",
             COALESCE(SUM(regular_hours), 0) AS "totalRegular",
             COALESCE(SUM(ot_hours), 0) AS "totalOt",
             COALESCE(COUNT(CASE WHEN is_on_leave THEN 1 END), 0) AS "leaveDays",
             COALESCE(COUNT(CASE WHEN is_absent THEN 1 END), 0) AS "absentDays"
           FROM attendance_records
           WHERE attendance_period_id = :attPeriodId AND employee_id = :empId;`,
          { replacements: { attPeriodId, empId }, type: QueryTypes.SELECT },
        );

        const totalActualHours = parseFloat(attStats[0].totalActual) || 0;
        const totalRegularHours = parseFloat(attStats[0].totalRegular) || 0;
        const totalOtHours = parseFloat(attStats[0].totalOt) || 0;
        const totalLeaveDays = parseFloat(attStats[0].leaveDays) || 0;
        const totalAbsenceDays = parseInt(attStats[0].absentDays, 10) || 0;

        let empGrossPay = 0;

        const [itemRow] = await sequelize.query<{ id: string }>(
          `INSERT INTO payroll_items (
             id, payroll_period_id, employee_id, remuneration_basis, designation_id, days_in_period,
             total_actual_hours, total_regular_hours, total_ot_hours, total_absence_days, total_leave_days,
             gross_pay, total_deductions, net_pay, has_blocking_issue, blocking_reason, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), :payrollPeriodId, :empId, :remunerationBasis, :desigId, 31,
             :totalActualHours, :totalRegularHours, :totalOtHours, :totalAbsenceDays, :totalLeaveDays,
             0, 0, 0, false, NULL, NOW(), NOW()
           ) RETURNING id;`,
          {
            replacements: {
              payrollPeriodId,
              empId,
              remunerationBasis: emp.remunerationBasis,
              desigId,
              totalActualHours,
              totalRegularHours,
              totalOtHours,
              totalAbsenceDays,
              totalLeaveDays,
            },
            type: QueryTypes.SELECT,
          },
        );
        const itemId = itemRow.id;

        // Generate lines
        if (emp.remunerationBasis === 'salaried') {
          const basic = emp.basic || 5000;
          const hra = emp.hra || 2000;
          const transport = emp.transport || 1000;
          empGrossPay = round2(basic + hra + transport);

          const basicId = salaryComponentMap.get('BASIC')!;
          const hraId = salaryComponentMap.get('HRA')!;
          const transportId = salaryComponentMap.get('TRANSPORT')!;

          await sequelize.query(
            `INSERT INTO payroll_item_lines (
               id, payroll_item_id, category, is_manual, code, description, rate, quantity, amount, salary_component_id, created_at, updated_at
             ) VALUES
             (gen_random_uuid(), :itemId, 'earning', false, 'BASIC', 'Basic Salary', :basic, 1.0, :basic, :basicId, NOW(), NOW()),
             (gen_random_uuid(), :itemId, 'earning', false, 'HRA', 'House Rent Allowance', :hra, 1.0, :hra, :hraId, NOW(), NOW()),
             (gen_random_uuid(), :itemId, 'earning', false, 'TRANSPORT', 'Transport Allowance', :transport, 1.0, :transport, :transportId, NOW(), NOW());`,
            { replacements: { itemId, basic, hra, transport, basicId, hraId, transportId }, type: QueryTypes.RAW },
          );
        } else {
          // Hourly lines
          const normRate = emp.normalRate || 25.0;
          const otRate = emp.otRate || 35.0;
          const regAmount = round2(totalRegularHours * normRate);
          const otAmount = round2(totalOtHours * otRate);
          empGrossPay = round2(regAmount + otAmount);

          await sequelize.query(
            `INSERT INTO payroll_item_lines (
               id, payroll_item_id, category, is_manual, code, description, rate, quantity, amount, created_at, updated_at
             ) VALUES
             (gen_random_uuid(), :itemId, 'earning', false, 'REGULAR_PAY', 'Monthly Regular Hours Pay', :normRate, :totalRegularHours, :regAmount, NOW(), NOW()),
             (gen_random_uuid(), :itemId, 'earning', false, 'OVERTIME_PAY', 'Monthly Overtime Hours Pay', :otRate, :totalOtHours, :otAmount, NOW(), NOW());`,
            {
              replacements: {
                itemId,
                normRate,
                totalRegularHours,
                regAmount,
                otRate,
                totalOtHours,
                otAmount,
              },
              type: QueryTypes.RAW,
            },
          );
        }

        // Update item total
        await sequelize.query(
          `UPDATE payroll_items
           SET gross_pay = :empGrossPay, net_pay = :empGrossPay, total_deductions = 0
           WHERE id = :itemId;`,
          { replacements: { empGrossPay, itemId }, type: QueryTypes.RAW },
        );

        periodGrossTotal += empGrossPay;
      }

      // Update period summary
      const periodNetTotal = round2(periodGrossTotal - periodDeductionsTotal);
      await sequelize.query(
        `UPDATE payroll_periods
         SET total_gross_pay = :periodGrossTotal, total_deductions = :periodDeductionsTotal, total_net_pay = :periodNetTotal
         WHERE id = :payrollPeriodId;`,
        { replacements: { periodGrossTotal: round2(periodGrossTotal), periodDeductionsTotal: 0, periodNetTotal, payrollPeriodId }, type: QueryTypes.RAW },
      );

      console.log(`✓ Finalized ${pm.name}: 60 employees, Total Net: AED ${periodNetTotal.toLocaleString()}, 0 blocking issues.`);
    }

    // --------------------------------------------------------------------------
    // 12. SEED 10 CLIENT INVOICES & 20 PAYMENTS (ALL 100% PAID, 0 RECEIVABLES)
    // --------------------------------------------------------------------------
    console.log('\n--- Step 12: Generating 10 Client Invoices & 20 Payments ---');
    // 5 clients × 2 months (July 2026 & August 2026) = 10 Invoices
    const invoiceSpecs = [
      // July 2026
      { clientCode: 'CLI-MASAOOD', projectCode: 'PRJ-MASAOOD-01', period: '2026-07', invNum: 'INV-2026-07-0001', invDate: '2026-08-01', dueDate: '2026-08-31' },
      { clientCode: 'CLI-EMAAR', projectCode: 'PRJ-EMAAR-01', period: '2026-07', invNum: 'INV-2026-07-0002', invDate: '2026-08-01', dueDate: '2026-08-31' },
      { clientCode: 'CLI-DAMAC', projectCode: 'PRJ-DAMAC-01', period: '2026-07', invNum: 'INV-2026-07-0003', invDate: '2026-08-01', dueDate: '2026-08-31' },
      { clientCode: 'CLI-ALDAR', projectCode: 'PRJ-ALDAR-01', period: '2026-07', invNum: 'INV-2026-07-0004', invDate: '2026-08-01', dueDate: '2026-08-31' },
      { clientCode: 'CLI-BLUEROYAL', projectCode: 'PRJ-BLUEROYAL-01', period: '2026-07', invNum: 'INV-2026-07-0005', invDate: '2026-08-01', dueDate: '2026-08-31' },

      // August 2026
      { clientCode: 'CLI-MASAOOD', projectCode: 'PRJ-MASAOOD-01', period: '2026-08', invNum: 'INV-2026-08-0001', invDate: '2026-09-01', dueDate: '2026-09-30' },
      { clientCode: 'CLI-EMAAR', projectCode: 'PRJ-EMAAR-01', period: '2026-08', invNum: 'INV-2026-08-0002', invDate: '2026-09-01', dueDate: '2026-09-30' },
      { clientCode: 'CLI-DAMAC', projectCode: 'PRJ-DAMAC-01', period: '2026-08', invNum: 'INV-2026-08-0003', invDate: '2026-09-01', dueDate: '2026-09-30' },
      { clientCode: 'CLI-ALDAR', projectCode: 'PRJ-ALDAR-01', period: '2026-08', invNum: 'INV-2026-08-0004', invDate: '2026-09-01', dueDate: '2026-09-30' },
      { clientCode: 'CLI-BLUEROYAL', projectCode: 'PRJ-BLUEROYAL-01', period: '2026-08', invNum: 'INV-2026-08-0005', invDate: '2026-09-01', dueDate: '2026-09-30' },
    ];

    let paymentCounter = 1;

    for (const spec of invoiceSpecs) {
      const clientId = clientMap.get(spec.clientCode)!;
      const projectId = projectMap.get(spec.projectCode)!;

      // 1. Create client_invoices header
      const [invRow] = await sequelize.query<{ id: string }>(
        `INSERT INTO client_invoices (
           id, invoice_number, client_id, project_id, billing_period, invoice_date, due_date,
           status, subtotal, tax_amount, total_amount, currency, notes,
           approved_at, approved_by, issued_at, issued_by, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :invNum, :clientId, :projectId, :period, :invDate, :dueDate,
           'issued', 0, 0, 0, 'AED', 'Commercial invoice generated from verified timesheet hours.',
           NOW(), :hrAdminUserId, NOW(), :superAdminUserId, NOW(), NOW()
         ) RETURNING id;`,
        {
          replacements: {
            ...spec,
            clientId,
            projectId,
            hrAdminUserId,
            superAdminUserId,
          },
          type: QueryTypes.SELECT,
        },
      );
      const invoiceId = invRow.id;

      // 2. Fetch all verified employee attendance on this project for this period
      const attPeriodId = attendancePeriodMap.get(spec.period)!;
      const projectEmployees = EMPLOYEES_DATA.filter((e) => e.projectCode === spec.projectCode);

      let invoiceSubtotal = 0;

      for (const emp of projectEmployees) {
        const empId = empIdMap.get(emp.code)!;
        const desig = DESIGNATIONS_CONFIG.find((d) => d.code === emp.desigCode)!;

        const hoursQuery = await sequelize.query<{ regHours: string; otHours: string }>(
          `SELECT
             COALESCE(SUM(regular_hours), 0) AS "regHours",
             COALESCE(SUM(ot_hours), 0) AS "otHours"
           FROM attendance_records
           WHERE attendance_period_id = :attPeriodId
             AND employee_id = :empId
             AND is_absent = false
             AND is_on_leave = false;`,
          { replacements: { attPeriodId, empId }, type: QueryTypes.SELECT },
        );

        const regularHours = parseFloat(hoursQuery[0].regHours) || 0;
        const overtimeHours = parseFloat(hoursQuery[0].otHours) || 0;

        if (regularHours > 0) {
          const regAmount = round2(regularHours * desig.normalBillingRate);
          invoiceSubtotal += regAmount;

          await sequelize.query(
            `INSERT INTO client_invoice_lines (
               id, invoice_id, employee_id, project_id, description, designation_title,
               hours, overtime_hours, rate, ot_rate, amount, line_type, created_at, updated_at
             ) VALUES (
               gen_random_uuid(), :invoiceId, :empId, :projectId, :desc, :title,
               :regularHours, 0.0, :rate, 0.0, :regAmount, 'billable_regular', NOW(), NOW()
             );`,
            {
              replacements: {
                invoiceId,
                empId,
                projectId,
                desc: `${emp.firstName} ${emp.lastName} — Regular Hours`,
                title: desig.title,
                regularHours,
                rate: desig.normalBillingRate,
                regAmount,
              },
              type: QueryTypes.RAW,
            },
          );
        }

        if (overtimeHours > 0) {
          const otAmount = round2(overtimeHours * desig.otBillingRate);
          invoiceSubtotal += otAmount;

          await sequelize.query(
            `INSERT INTO client_invoice_lines (
               id, invoice_id, employee_id, project_id, description, designation_title,
               hours, overtime_hours, rate, ot_rate, amount, line_type, created_at, updated_at
             ) VALUES (
               gen_random_uuid(), :invoiceId, :empId, :projectId, :desc, :title,
               0.0, :overtimeHours, 0.0, :otRate, :otAmount, 'billable_overtime', NOW(), NOW()
             );`,
            {
              replacements: {
                invoiceId,
                empId,
                projectId,
                desc: `${emp.firstName} ${emp.lastName} — Overtime`,
                title: desig.title,
                overtimeHours,
                otRate: desig.otBillingRate,
                otAmount,
              },
              type: QueryTypes.RAW,
            },
          );
        }
      }

      invoiceSubtotal = round2(invoiceSubtotal);
      const taxAmount = round2(invoiceSubtotal * 0.05); // 5% UAE VAT
      const totalAmount = round2(invoiceSubtotal + taxAmount);

      // Update invoice total
      await sequelize.query(
        `UPDATE client_invoices
         SET subtotal = :invoiceSubtotal, tax_amount = :taxAmount, total_amount = :totalAmount
         WHERE id = :invoiceId;`,
        { replacements: { invoiceSubtotal, taxAmount, totalAmount, invoiceId }, type: QueryTypes.RAW },
      );

      // 3. Create 2 Payments to fully pay the invoice (0 receivables)
      // Payment 1: 60% partial payment
      const p1Amount = round2(totalAmount * 0.6);
      const p2Amount = round2(totalAmount - p1Amount);

      const p1Number = `PAY-REC-2026-${String(paymentCounter++).padStart(4, '0')}`;
      const [pay1Row] = await sequelize.query<{ id: string }>(
        `INSERT INTO client_payments (
           id, payment_number, client_id, payment_date, amount, currency, payment_method,
           reference_number, notes, status, recorded_by, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :p1Number, :clientId, :paymentDate, :p1Amount, 'AED', 'BANK_TRANSFER',
           :refNum, 'First partial installment', 'RECORDED', :hrAdminUserId, NOW(), NOW()
         ) RETURNING id;`,
        {
          replacements: {
            p1Number,
            clientId,
            paymentDate: spec.period === '2026-07' ? '2026-08-15' : '2026-09-08',
            p1Amount,
            refNum: `TXN-${spec.clientCode}-${spec.period}-01`,
            hrAdminUserId,
          },
          type: QueryTypes.SELECT,
        },
      );

      await sequelize.query(
        `INSERT INTO invoice_payment_allocations (
           id, payment_id, invoice_id, allocated_amount, created_by, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :paymentId, :invoiceId, :p1Amount, :hrAdminUserId, NOW(), NOW()
         );`,
        { replacements: { paymentId: pay1Row.id, invoiceId, p1Amount, hrAdminUserId }, type: QueryTypes.RAW },
      );

      // Payment 2: Remaining 40% balance
      const p2Number = `PAY-REC-2026-${String(paymentCounter++).padStart(4, '0')}`;
      const [pay2Row] = await sequelize.query<{ id: string }>(
        `INSERT INTO client_payments (
           id, payment_number, client_id, payment_date, amount, currency, payment_method,
           reference_number, notes, status, recorded_by, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :p2Number, :clientId, :paymentDate, :p2Amount, 'AED', 'BANK_TRANSFER',
           :refNum, 'Settlement balance payment', 'RECORDED', :hrAdminUserId, NOW(), NOW()
         ) RETURNING id;`,
        {
          replacements: {
            p2Number,
            clientId,
            paymentDate: spec.period === '2026-07' ? '2026-08-25' : '2026-09-10',
            p2Amount,
            refNum: `TXN-${spec.clientCode}-${spec.period}-02`,
            hrAdminUserId,
          },
          type: QueryTypes.SELECT,
        },
      );

      await sequelize.query(
        `INSERT INTO invoice_payment_allocations (
           id, payment_id, invoice_id, allocated_amount, created_by, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), :paymentId, :invoiceId, :p2Amount, :hrAdminUserId, NOW(), NOW()
         );`,
        { replacements: { paymentId: pay2Row.id, invoiceId, p2Amount, hrAdminUserId }, type: QueryTypes.RAW },
      );

      console.log(`✓ Invoice ${spec.invNum} (${spec.period}): AED ${totalAmount.toLocaleString()} -> 100% PAID by 2 payments.`);
    }

    console.log(`✓ 10 Invoices and 20 Payments created. All invoices PAID, outstanding balance: AED 0.00.`);

    // --------------------------------------------------------------------------
    // 13. PRINT SUMMARY & CREDENTIALS
    // --------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('   PRODUCTION DEMO SEEDING COMPLETED SUCCESSFULLY!             ');
    console.log('================================================================');
    console.log('| Metric                     | Seeded Count                    |');
    console.log('+----------------------------+---------------------------------+');
    console.log('| Clients                    | 5                               |');
    console.log('| Projects                   | 10 (2 per client)               |');
    console.log('| Project Billing Rates      | 60 (6 designations per project) |');
    console.log('| Employees                  | 60 (with photos, docs & rates)  |');
    console.log('| Attendance Records         | ' + totalAttendanceRecords.toString().padEnd(32, ' ') + '|');
    console.log('| Payroll Periods Finalized  | 2 (July & August 2026)          |');
    console.log('| Payroll Employee Items     | 120 (60 per month, 0 blocked)   |');
    console.log('| Invoices Issued & Paid     | 10 (July & August 2026)         |');
    console.log('| Payments Recorded          | 20 (2 payments per invoice)     |');
    console.log('| Total Receivables Overdue  | AED 0.00                        |');
    console.log('+----------------------------+---------------------------------+\n');

    console.log('+--------------------+-------------------------------+----------------------------------------+');
    console.log('| Role               | Demo Email Address            | Password                               |');
    console.log('+--------------------+-------------------------------+----------------------------------------+');
    for (const item of Object.values(credentialsOutput)) {
      const roleStr = item.role.padEnd(18, ' ');
      const emailStr = item.email.padEnd(29, ' ');
      const passStr = item.password.padEnd(38, ' ');
      console.log(`| ${roleStr} | ${emailStr} | ${passStr} |`);
    }
    console.log('+--------------------+-------------------------------+----------------------------------------+\n');

    return credentialsOutput;
  } catch (error) {
    console.error('Demo seeder failed:', error);
    throw error;
  }
}

if (require.main === module) {
  const validateOnly = process.argv.includes('--validate-only');

  if (validateOnly) {
    validateProductionTransferConnection()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('[seed-transfer] Raw pg validation failed:', error);
        process.exit(1);
      });
  } else if (process.env.ALLOW_DESTRUCTIVE_SEED === 'true') {
    seedDemoUsers()
      .then(async () => {
        await sequelize.close();
        process.exit(0);
      })
      .catch(async () => {
        await sequelize.close();
        process.exit(1);
      });
  } else {
    console.log('[seed-transfer] Production/Existing database protected. Skipping destructive demo seed.');
    process.exit(0);
  }
}
