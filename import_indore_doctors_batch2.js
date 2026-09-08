require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Indore Doctor List Import (Batch 2 - DOCTOR List Format (1).xlsx)...\n');

  // 1. Locate Indore Territory (Headquarter)
  let indoreHq = await prisma.territory.findFirst({
    where: {
      OR: [
        { code: 'HQ-INDORE' },
        { name: { equals: 'Indore', mode: 'insensitive' } }
      ]
    }
  });

  if (!indoreHq) {
    throw new Error('❌ Indore Headquarter (HQ-INDORE) territory not found in database!');
  }
  console.log(`✅ Found Indore HQ: ${indoreHq.name} (Code: ${indoreHq.code}, ID: ${indoreHq.id})`);

  // 2. Setup Sub-Areas / Beats for Indore HQ
  const areaConfigs = [
    { name: 'Vijay Nagar', code: 'AREA-IND-VIJAY', district: 'Indore', state: 'Madhya Pradesh', pinCode: '452010' },
    { name: 'Palasia - Geeta Bhawan', code: 'AREA-IND-PALASIA', district: 'Indore', state: 'Madhya Pradesh', pinCode: '452001' },
    { name: 'Scheme 78 - Mahalaxmi Nagar', code: 'AREA-IND-SCH78', district: 'Indore', state: 'Madhya Pradesh', pinCode: '452010' },
    { name: 'LIG - Malwa Mill', code: 'AREA-IND-LIG', district: 'Indore', state: 'Madhya Pradesh', pinCode: '452008' },
    { name: 'Bapat - Sukliya', code: 'AREA-IND-BAPAT', district: 'Indore', state: 'Madhya Pradesh', pinCode: '452010' },
    { name: 'Khajrana', code: 'AREA-IND-KHAJRANA', district: 'Indore', state: 'Madhya Pradesh', pinCode: '452016' },
    { name: 'Pardeshipura - Nanda Nagar', code: 'AREA-IND-PARDESHI', district: 'Indore', state: 'Madhya Pradesh', pinCode: '452003' },
    { name: 'Mhow', code: 'AREA-IND-MHOW', district: 'Indore', state: 'Madhya Pradesh', pinCode: '453441' },
    { name: 'Bengali Square - Tilak Nagar', code: 'AREA-IND-BENGALI', district: 'Indore', state: 'Madhya Pradesh', pinCode: '452016' },
    { name: 'Rau - Rangwasa', code: 'AREA-IND-RAU', district: 'Indore', state: 'Madhya Pradesh', pinCode: '453331' },
    { name: 'Dewas', code: 'AREA-IND-DEWAS', district: 'Dewas', state: 'Madhya Pradesh', pinCode: '455001' },
  ];

  const areaMap = {};

  for (const cfg of areaConfigs) {
    let area = await prisma.area.findFirst({
      where: {
        hqId: indoreHq.id,
        name: { equals: cfg.name, mode: 'insensitive' }
      }
    });

    if (!area) {
      area = await prisma.area.create({
        data: {
          areaCode: cfg.code,
          name: cfg.name,
          district: cfg.district,
          state: cfg.state,
          pinCode: cfg.pinCode,
          hqId: indoreHq.id,
          isActive: true
        }
      });
      console.log(`📍 Created new Area: ${area.name} (Code: ${area.areaCode}, ID: ${area.id})`);
    } else {
      console.log(`📍 Found existing Area: ${area.name} (ID: ${area.id})`);
    }
    areaMap[cfg.name] = area;
  }

  // 3. Read doctors data from indore_doctors_batch2.json
  const jsonPath = path.join(__dirname, 'indore_doctors_batch2.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`❌ indore_doctors_batch2.json not found at ${jsonPath}`);
  }
  const doctorsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`\n📋 Loaded ${doctorsData.length} doctors from indore_doctors_batch2.json`);

  // 4. Upsert doctors into database
  let insertedCount = 0;
  let updatedCount = 0;

  for (const d of doctorsData) {
    const targetArea = areaMap[d.area] || areaMap['Palasia - Geeta Bhawan'];

    const doctorPayload = {
      doctorCode: d.doctorCode,
      salutation: d.salutation,
      firstName: d.firstName,
      middleName: d.middleName || null,
      lastName: d.lastName,
      specialty: d.specialty,
      qualification: d.qualification,
      classification: d.classification,
      category: d.category,
      prescriber: true,
      prescriptionPotential: d.prescriptionPotential || 35000,
      phone: d.phone || null,
      whatsappNumber: d.whatsappNumber || null,
      email: d.email || null,
      address: d.address,
      address1: d.address1,
      city: d.city,
      district: d.district,
      state: d.state,
      pincode: d.pincode,
      hqId: indoreHq.id,
      territoryId: indoreHq.id,
      areaId: targetArea.id,
      visitFrequency: 2,
      approvalStatus: 'APPROVED',
      isActive: true,
    };

    // Check for existing by doctorCode
    const existing = await prisma.doctor.findFirst({
      where: { doctorCode: d.doctorCode }
    });

    if (existing) {
      await prisma.doctor.update({
        where: { id: existing.id },
        data: doctorPayload
      });
      updatedCount++;
    } else {
      await prisma.doctor.create({
        data: doctorPayload
      });
      insertedCount++;
    }
  }

  console.log(`\n🎉 Batch 2 Import Complete!`);
  console.log(`   - Newly Inserted: ${insertedCount}`);
  console.log(`   - Updated/Refreshed: ${updatedCount}`);
  console.log(`   - Total Processed: ${doctorsData.length}`);

  // 5. Summary Verification
  const totalInDb = await prisma.doctor.count({
    where: {
      hqId: indoreHq.id,
      isActive: true,
      deletedAt: null
    }
  });

  const areaBreakdown = await prisma.area.findMany({
    where: { hqId: indoreHq.id },
    include: {
      _count: {
        select: {
          doctors: {
            where: { isActive: true, deletedAt: null }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log(`\n📊 Total Active Doctors in Indore HQ: ${totalInDb}`);
  console.log('📍 Area Distribution:');
  for (const a of areaBreakdown) {
    console.log(`   - ${a.name} (${a.areaCode}): ${a._count.doctors} doctors`);
  }

  const mrUsers = await prisma.user.findMany({
    where: {
      territories: {
        some: { territoryId: indoreHq.id }
      },
      role: 'MR'
    },
    select: { firstName: true, lastName: true, email: true }
  });

  console.log('\n👤 Assigned MRs for Indore HQ:');
  for (const u of mrUsers) {
    console.log(`   - ${u.firstName} ${u.lastName} (${u.email})`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error executing import_indore_doctors_batch2:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
