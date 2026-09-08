import { migrator } from '../migrator';
import { sequelize } from '../config/db';

async function run(): Promise<void> {
  const command = process.argv[2] || 'status';

  try {
    await sequelize.authenticate();

    if (command === 'up') {
      console.log('Running pending migrations...');
      const migrations = await migrator.up();
      if (migrations.length === 0) {
        console.log('No pending migrations found. Database schema is up to date.');
      } else {
        console.log(`Successfully executed ${migrations.length} migration(s):`);
        migrations.forEach((m) => console.log(` - ${m.name}`));
      }
    } else if (command === 'down') {
      console.log('Reverting last migration...');
      const reverted = await migrator.down();
      if (reverted.length === 0) {
        console.log('No migrations to revert.');
      } else {
        console.log(`Successfully reverted:`);
        reverted.forEach((m) => console.log(` - ${m.name}`));
      }
    } else if (command === 'status') {
      const executed = await migrator.executed();
      const pending = await migrator.pending();

      console.log('\n=== Database Migration Status ===');
      console.log(`Total Executed: ${executed.length}`);
      executed.forEach((m) => console.log(` [APPLIED] ${m.name}`));
      console.log(`Total Pending:  ${pending.length}`);
      pending.forEach((m) => console.log(` [PENDING] ${m.name}`));
      console.log('=================================\n');
    } else {
      console.error(`Unknown command "${command}". Available commands: up, down, status.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
