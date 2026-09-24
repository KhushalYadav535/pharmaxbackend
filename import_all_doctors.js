require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const isForce = process.argv.includes('--force');

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const existingDoctorCount = await prisma.doctor.count();
    console.log(`📊 Current doctor count in database: ${existingDoctorCount}`);

    // If already seeded and not forced, skip immediately!
    if (existingDoctorCount >= 500 && !isForce) {
      console.log(`\n⚡ Doctors already exist in database (${existingDoctorCount} doctors found).`);
      console.log(`⏭️  Skipping doctor seeding to keep deployment fast.`);
      console.log(`💡 Tip: If you ever want to forcefully re-seed, run with: node import_all_doctors.js --force\n`);
      process.exit(0);
    }

    if (isForce) {
      console.log('⚠️ --force flag detected: Running full doctor sync regardless of current count.\n');
    } else {
      console.log('🌱 Database is missing doctors. Starting one-time master seed...\n');
    }

    const scripts = [
      { name: 'Nagpur Doctors (Vidarbha)', file: 'import_nagpur_doctors.js' },
      { name: 'Indore Doctors - Batch 1', file: 'import_indore_doctors.js' },
      { name: 'Indore Doctors - Batch 2', file: 'import_indore_doctors_batch2.js' },
      { name: 'Ujjain Doctors', file: 'import_ujjain_doctors.js' },
      { name: 'Burhanpur Doctors', file: 'import_burhanpur_doctors.js' },
      { name: 'Khargone Doctors', file: 'import_khargone_doctors.js' },
      { name: 'Santosh Telang MR Setup', file: 'create_santosh_mr.js' },
      { name: 'Approve All Records', file: 'approve_existing.js' },
    ];

    console.log('=====================================================');
    console.log('🚀 MASTER SEED: Importing All Headquarters & Doctors');
    console.log('=====================================================\n');

    let successCount = 0;
    let failCount = 0;

    for (const script of scripts) {
      const scriptPath = path.join(__dirname, script.file);
      console.log(`\n-----------------------------------------------------`);
      console.log(`▶ Running: ${script.name} (${script.file})`);
      console.log(`-----------------------------------------------------`);

      try {
        execSync(`"${process.execPath}" "${scriptPath}"`, {
          stdio: 'inherit',
          cwd: __dirname,
          env: process.env,
        });
        console.log(`✅ Finished: ${script.name}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed: ${script.name} (Continuing with next...)`, error.message);
        failCount++;
      }
    }

    console.log('\n=====================================================');
    console.log(`🏁 MASTER SEED COMPLETED: ${successCount} succeeded, ${failCount} failed.`);
    console.log('=====================================================\n');
    process.exit(failCount > 0 ? 1 : 0);
  } finally {
    // Adapter client doesn't need explicit disconnect, but good practice
  }
}

main().catch((err) => {
  console.error('❌ Master seed error:', err);
  process.exit(1);
});
