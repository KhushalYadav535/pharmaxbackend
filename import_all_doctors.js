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
    const existingUserCount = await prisma.user.count({ where: { isActive: true } });
    const burhanpurDocCount = await prisma.doctor.count({
      where: {
        OR: [
          { hq: { code: 'HQ-BURHANPUR' } },
          { territory: { code: 'HQ-BURHANPUR' } }
        ]
      }
    });
    const nagpurDocCount = await prisma.doctor.count({
      where: {
        OR: [
          { hq: { code: 'HQ-NAGPUR' } },
          { territory: { code: 'HQ-NAGPUR' } }
        ]
      }
    });
    const santoshExists = await prisma.user.findFirst({
      where: { email: { equals: 'santoshtelang@gmail.com', mode: 'insensitive' } }
    });
    console.log(`📊 Current in DB: ${existingDoctorCount} doctors (${burhanpurDocCount} Burhanpur, ${nagpurDocCount} Nagpur), ${existingUserCount} active employees (Santosh: ${santoshExists ? 'YES' : 'NO'})`);

    // If already seeded and both Burhanpur & Nagpur are present and Santosh exists, skip!
    if (existingDoctorCount >= 550 && existingUserCount >= 17 && santoshExists && burhanpurDocCount >= 50 && nagpurDocCount >= 50 && !isForce) {
      console.log(`\n⚡ Data already exists in database (${existingDoctorCount} doctors, ${existingUserCount} employees).`);
      console.log(`⏭️  Skipping seeding to keep deployment fast.`);
      console.log(`💡 Tip: If you ever want to forcefully re-seed, run with: node import_all_doctors.js --force\n`);
      process.exit(0);
    }

    if (isForce) {
      console.log('⚠️ --force flag detected: Running full sync regardless of current count.\n');
    } else {
      console.log('🌱 Database is missing doctors or employees. Starting master seed...\n');
    }

    const scripts = [
      { name: 'Biocros Employees & Logins Setup', file: 'seed_all_employees.js' },
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
