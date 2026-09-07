const { execSync } = require('child_process');

console.log('--- STARTING RENDER DEPLOYMENT SCRIPT ---');

try {
  console.log('1. Attempting to resolve the failed migration...');
  // This will fix the P3009 error
  execSync('npx prisma migrate resolve --rolled-back 20260821022125_ffms_data_fields_alignment', { stdio: 'inherit' });
} catch (e) {
  console.log('Note: Resolve command skipped or already resolved. Continuing...');
}

try {
  console.log('\n2. Syncing database schema with prisma db push...');
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
} catch (e) {
  console.error('CRITICAL: Database sync failed!');
  process.exit(1);
}

try {
  console.log('\n3. Running script to auto-approve existing records...');
  execSync('node approve_existing.js', { stdio: 'inherit' });
} catch (e) {
  console.error('CRITICAL: Failed to auto-approve existing records!');
  process.exit(1);
}

try {
  console.log('\n4. Running Biocros data migration & purge seed...');
  execSync('npx tsx prisma/seed_biocros.ts', { stdio: 'inherit' });
} catch (e) {
  console.error('CRITICAL: Failed to run Biocros data migration!');
  process.exit(1);
}

try {
  console.log('\n5. Running Ujjain doctor list import...');
  execSync('node import_ujjain_doctors.js', { stdio: 'inherit' });
} catch (e) {
  console.error('CRITICAL: Failed to import Ujjain doctors!');
  process.exit(1);
}

console.log('\n--- RENDER DEPLOYMENT SCRIPT COMPLETED SUCCESSFULLY ---');
