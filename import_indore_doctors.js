require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Indore Doctor List Import...\n');

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
  ];

  const areaMap = {};

  // Check if existing "Indore Central Area" exists, we can rename it to "Vijay Nagar"
  const existingCentralArea = await prisma.area.findFirst({
    where: { hqId: indoreHq.id, name: 'Indore Central Area' }
  });
  if (existingCentralArea) {
    const updated = await prisma.area.update({
      where: { id: existingCentralArea.id },
      data: { name: 'Vijay Nagar', areaCode: 'AREA-IND-VIJAY', district: 'Indore', state: 'Madhya Pradesh', pinCode: '452010' }
    });
    areaMap['Vijay Nagar'] = updated;
    console.log(`📍 Renamed existing "Indore Central Area" -> "Vijay Nagar" (${updated.id})`);
  }

  for (const cfg of areaConfigs) {
    if (areaMap[cfg.name]) continue;
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

  // 3. Remove/deactivate initial placeholder mock doctors in Indore HQ
  const dummyDocIds = [
    '424ca286-98e2-4a2e-9013-9c15c078ee14', // Rajesh Sharma
    '6851f22d-aab1-420c-9a61-578c901f621d', // Sunil Verma
  ];
  for (const dummyId of dummyDocIds) {
    const doc = await prisma.doctor.findUnique({ where: { id: dummyId } });
    if (doc && doc.hqId === indoreHq.id) {
      const visitCount = await prisma.visit.count({ where: { doctorId: dummyId } });
      if (visitCount === 0) {
        await prisma.doctor.delete({ where: { id: dummyId } });
        console.log(`🗑️ Deleted placeholder doctor: ${doc.firstName} ${doc.lastName} (${dummyId})`);
      } else {
        await prisma.doctor.update({
          where: { id: dummyId },
          data: { isActive: false, deletedAt: new Date() }
        });
        console.log(`🔒 Soft-deleted placeholder doctor: ${doc.firstName} ${doc.lastName} (${dummyId})`);
      }
    }
  }

  // Also clean up any un-coded doctors named 'Rajesh Sharma' or 'Sunil Verma' in Indore HQ if generated with fresh IDs
  const remainingDummies = await prisma.doctor.findMany({
    where: {
      hqId: indoreHq.id,
      doctorCode: null,
      OR: [
        { firstName: 'Rajesh', lastName: 'Sharma' },
        { firstName: 'Sunil', lastName: 'Verma' }
      ]
    }
  });
  for (const dummy of remainingDummies) {
    const visitCount = await prisma.visit.count({ where: { doctorId: dummy.id } });
    if (visitCount === 0) {
      await prisma.doctor.delete({ where: { id: dummy.id } });
      console.log(`🗑️ Deleted un-coded dummy doctor: ${dummy.firstName} ${dummy.lastName} (${dummy.id})`);
    } else {
      await prisma.doctor.update({
        where: { id: dummy.id },
        data: { isActive: false, deletedAt: new Date() }
      });
      console.log(`🔒 Soft-deleted un-coded dummy doctor: ${dummy.firstName} ${dummy.lastName} (${dummy.id})`);
    }
  }

  // 4. Read doctors data from indore_doctors.json
  const jsonPath = path.join(__dirname, 'indore_doctors.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`❌ indore_doctors.json not found at ${jsonPath}`);
  }
  const doctorsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`\n📋 Loaded ${doctorsData.length} doctors from indore_doctors.json`);

  // 5. Upsert doctors into database
  let insertedCount = 0;
  let updatedCount = 0;

  for (const d of doctorsData) {
    const targetArea = areaMap[d.area] || areaMap['Vijay Nagar'];

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
      prescriptionPotential: 40000,
      phone: d.phone,
      whatsappNumber: d.whatsappNumber,
      email: d.email,
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

  console.log(`\n🎉 Import Complete!`);
  console.log(`   - Newly Inserted: ${insertedCount}`);
  console.log(`   - Updated/Refreshed: ${updatedCount}`);
  console.log(`   - Total Processed: ${doctorsData.length}`);

  // 6. Summary Verification
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

  console.log(`\n📊 Active Doctors in Indore HQ: ${totalInDb}`);
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
    console.error('❌ Error executing import_indore_doctors:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
