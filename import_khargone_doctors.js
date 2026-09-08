require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Khargone Doctor List Import...\n');

  // 1. Locate Khargone Territory (Headquarter)
  let khargoneHq = await prisma.territory.findFirst({
    where: {
      OR: [
        { code: 'HQ-KHARGOAN' },
        { code: 'HQ-KHARGONE' },
        { name: { equals: 'Khargoan', mode: 'insensitive' } },
        { name: { equals: 'Khargone', mode: 'insensitive' } }
      ]
    }
  });

  if (!khargoneHq) {
    throw new Error('❌ Khargone Headquarter (HQ-KHARGOAN) territory not found in database!');
  }
  console.log(`✅ Found Khargone HQ: ${khargoneHq.name} (Code: ${khargoneHq.code}, ID: ${khargoneHq.id})`);

  // 2. Setup Sub-Areas / Beats for Khargone HQ
  const areaConfigs = [
    { name: 'Khargone', code: 'AREA-KHAR-KHARGONE', district: 'Khargone', state: 'Madhya Pradesh', pinCode: '451001' },
    { name: 'Sanawad', code: 'AREA-KHAR-SANAWAD', district: 'Khargone', state: 'Madhya Pradesh', pinCode: '451111' },
    { name: 'Barwaha', code: 'AREA-KHAR-BARWAHA', district: 'Khargone', state: 'Madhya Pradesh', pinCode: '451115' },
    { name: 'Maheshwar', code: 'AREA-KHAR-MAHESHWAR', district: 'Khargone', state: 'Madhya Pradesh', pinCode: '451224' },
    { name: 'Mandleshwar', code: 'AREA-KHAR-MANDLESHWAR', district: 'Khargone', state: 'Madhya Pradesh', pinCode: '451221' },
    { name: 'Sendhwa', code: 'AREA-KHAR-SENDHWA', district: 'Barwani', state: 'Madhya Pradesh', pinCode: '451666' },
    { name: 'Dhamnod', code: 'AREA-KHAR-DHAMNOD', district: 'Dhar', state: 'Madhya Pradesh', pinCode: '454552' },
    { name: 'Dharampuri', code: 'AREA-KHAR-DHARAMPURI', district: 'Dhar', state: 'Madhya Pradesh', pinCode: '454552' },
    { name: 'Khalghat', code: 'AREA-KHAR-KHALGHAT', district: 'Dhar', state: 'Madhya Pradesh', pinCode: '454552' },
  ];

  const areaMap = {};

  // Check if existing "Khargoan Central Area" exists, rename to "Khargone"
  const existingCentralArea = await prisma.area.findFirst({
    where: { hqId: khargoneHq.id, name: { contains: 'Central', mode: 'insensitive' } }
  });
  if (existingCentralArea) {
    const updated = await prisma.area.update({
      where: { id: existingCentralArea.id },
      data: { name: 'Khargone', areaCode: 'AREA-KHAR-KHARGONE', district: 'Khargone', state: 'Madhya Pradesh', pinCode: '451001' }
    });
    areaMap['Khargone'] = updated;
    console.log(`📍 Renamed existing "Khargoan Central Area" -> "Khargone" (${updated.id})`);
  }

  for (const cfg of areaConfigs) {
    if (areaMap[cfg.name]) continue;
    let area = await prisma.area.findFirst({
      where: {
        hqId: khargoneHq.id,
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
          hqId: khargoneHq.id,
          isActive: true
        }
      });
      console.log(`📍 Created new Area: ${area.name} (Code: ${area.areaCode}, ID: ${area.id})`);
    } else {
      console.log(`📍 Found existing Area: ${area.name} (ID: ${area.id})`);
    }
    areaMap[cfg.name] = area;
  }

  // 3. Remove/clean up placeholder mock doctors in Khargone HQ
  const dummyDocIds = [
    '7e29dc91-c264-4fb2-a098-4593bdf9e845', // Rajesh Sharma
    'f9f1ce1b-db9f-48a3-ae24-8bca4bab283e', // Sunil Verma
  ];
  for (const dummyId of dummyDocIds) {
    const doc = await prisma.doctor.findUnique({ where: { id: dummyId } });
    if (doc && doc.hqId === khargoneHq.id) {
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

  // Also clean up any un-coded doctors named 'Rajesh Sharma' or 'Sunil Verma' in Khargone HQ
  const remainingDummies = await prisma.doctor.findMany({
    where: {
      hqId: khargoneHq.id,
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

  // 4. Read doctors data from khargone_doctors.json
  const jsonPath = path.join(__dirname, 'khargone_doctors.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`❌ khargone_doctors.json not found at ${jsonPath}`);
  }
  const doctorsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`\n📋 Loaded ${doctorsData.length} doctors from khargone_doctors.json`);

  // 5. Upsert doctors into database
  let insertedCount = 0;
  let updatedCount = 0;

  for (const d of doctorsData) {
    const targetArea = areaMap[d.area] || areaMap['Khargone'];

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
      prescriptionPotential: d.prescriptionPotential || 30000,
      phone: d.phone || null,
      whatsappNumber: d.whatsappNumber || null,
      email: d.email || null,
      address: d.address,
      address1: d.address1,
      city: d.city,
      district: d.district,
      state: d.state,
      pincode: d.pincode,
      hqId: khargoneHq.id,
      territoryId: khargoneHq.id,
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

  console.log(`\n🎉 Khargone Doctor Import Complete!`);
  console.log(`   - Newly Inserted: ${insertedCount}`);
  console.log(`   - Updated/Refreshed: ${updatedCount}`);
  console.log(`   - Total Processed: ${doctorsData.length}`);

  // 6. Summary Verification
  const totalInDb = await prisma.doctor.count({
    where: {
      hqId: khargoneHq.id,
      isActive: true,
      deletedAt: null
    }
  });

  const areaBreakdown = await prisma.area.findMany({
    where: { hqId: khargoneHq.id },
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

  console.log(`\n📊 Total Active Doctors in Khargone HQ: ${totalInDb}`);
  console.log('📍 Area Distribution:');
  for (const a of areaBreakdown) {
    console.log(`   - ${a.name} (${a.areaCode}): ${a._count.doctors} doctors`);
  }

  const mrUsers = await prisma.user.findMany({
    where: {
      territories: {
        some: { territoryId: khargoneHq.id }
      },
      role: 'MR'
    },
    select: { firstName: true, lastName: true, email: true }
  });

  console.log('\n👤 Assigned MRs for Khargone HQ:');
  for (const u of mrUsers) {
    console.log(`   - ${u.firstName} ${u.lastName} (${u.email})`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error executing import_khargone_doctors:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
