import { createMigrationDatabase } from './migration-db.ts';

const command = process.argv[2] ?? 'help';

const printUsage = () => {
  console.log('Usage: npm run db:migrate:<command>');
  console.log('Commands: latest, rollback, status');
  console.log('Connection source: DATABASE_INFORMATION env var or functions/.secret.local');
};

if (command === 'help' || command === '--help' || command === '-h') {
  printUsage();
  process.exit(0);
}

const { db, destroy } = await createMigrationDatabase();

try {
  if (command === 'latest') {
    const [batchNo, migrations] = await db.migrate.latest();
    console.log(`Applied migration batch ${batchNo}.`);
    console.log(migrations.length > 0 ? migrations.join('\n') : 'No new migrations to apply.');
  } else if (command === 'rollback') {
    const [batchNo, migrations] = await db.migrate.rollback();
    console.log(`Rolled back migration batch ${batchNo}.`);
    console.log(migrations.length > 0 ? migrations.join('\n') : 'No migrations were rolled back.');
  } else if (command === 'status') {
    const version = await db.migrate.currentVersion();
    console.log(version);
  } else {
    printUsage();
    throw new Error(`Unknown migration command: ${command}`);
  }
} finally {
  await destroy();
}
