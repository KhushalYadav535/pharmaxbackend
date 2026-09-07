require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Burhanpur Doctor List Import...\n');

  // 1. Locate Burhanpur Territory (Headquarter)
  let burhanpurHq = await prisma.territory.findFirst({
    where: {
      OR: [
        { code: 'HQ-BURHANPUR' },
        { name: { equals: 'Burhanpur', mode: 'insensitive' } }
      ]
    }
  });

  if (!burhanpurHq) {
    throw new Error('❌ Burhanpur Headquarter (HQ-BURHANPUR) territory not found in database!');
  }
  console.log(`✅ Found Burhanpur HQ: ${burhanpurHq.name} (Code: ${burhanpurHq.code}, ID: ${burhanpurHq.id})`);

  // 2. Setup Areas for Burhanpur HQ
  const areaConfigs = [
    { name: 'Burhanpur', code: 'AREA-BURH-CITY', district: 'Burhanpur', state: 'Madhya Pradesh', pinCode: '450331' },
    { name: 'Khandwa', code: 'AREA-BURH-KHANDWA', district: 'Khandwa', state: 'Madhya Pradesh', pinCode: '450001' },
    { name: 'Shahpur', code: 'AREA-BURH-SHAHPUR', district: 'Burhanpur', state: 'Madhya Pradesh', pinCode: '450445' },
    { name: 'Chhanera - Khirkiya', code: 'AREA-BURH-CHHANERA', district: 'Khandwa', state: 'Madhya Pradesh', pinCode: '450116' },
    { name: 'Dhulkot - Bori', code: 'AREA-BURH-DHULKOT', district: 'Burhanpur', state: 'Madhya Pradesh', pinCode: '450332' },
    { name: 'Khakner - Dedtalai', code: 'AREA-BURH-KHAKNER', district: 'Burhanpur', state: 'Madhya Pradesh', pinCode: '450332' },
    { name: 'Nepanagar', code: 'AREA-BURH-NEPANAGAR', district: 'Burhanpur', state: 'Madhya Pradesh', pinCode: '450221' },
  ];

  const areaMap = {};

  // Check if existing "Burhanpur Central Area" exists, we can rename it to "Burhanpur"
  const existingCentralArea = await prisma.area.findFirst({
    where: { hqId: burhanpurHq.id, name: 'Burhanpur Central Area' }
  });
  if (existingCentralArea) {
    const updated = await prisma.area.update({
      where: { id: existingCentralArea.id },
      data: { name: 'Burhanpur', district: 'Burhanpur', state: 'Madhya Pradesh', pinCode: '450331' }
    });
    areaMap['Burhanpur'] = updated;
    console.log(`📍 Renamed existing "Burhanpur Central Area" -> "Burhanpur" (${updated.id})`);
  }

  for (const cfg of areaConfigs) {
    if (areaMap[cfg.name]) continue;
    let area = await prisma.area.findFirst({
      where: {
        hqId: burhanpurHq.id,
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
          hqId: burhanpurHq.id,
          isActive: true
        }
      });
      console.log(`📍 Created new Area: ${area.name} (Code: ${area.areaCode}, ID: ${area.id})`);
    } else {
      console.log(`📍 Found existing Area: ${area.name} (ID: ${area.id})`);
    }
    areaMap[cfg.name] = area;
  }

  // 3. Remove/deactivate initial placeholder mock doctors in Burhanpur HQ
  const dummyDocIds = [
    'bde8571a-9bb1-4356-8570-b2a5dbe2a898', // Rajesh Sharma
    'dd86df32-efb8-4ee1-809e-5796208f857b', // Sunil Verma
  ];
  for (const dummyId of dummyDocIds) {
    const doc = await prisma.doctor.findUnique({ where: { id: dummyId } });
    if (doc && doc.hqId === burhanpurHq.id) {
      const visitCount = await prisma.visit.count({ where: { doctorId: dummyId } });
      if (visitCount === 0) {
        await prisma.doctor.delete({ where: { id: dummyId } });
        console.log(`🗑️ Removed placeholder doctor: ${doc.firstName} ${doc.lastName} (${dummyId})`);
      } else {
        await prisma.doctor.update({
          where: { id: dummyId },
          data: { deletedAt: new Date(), isActive: false }
        });
        console.log(`📦 Soft-deleted placeholder doctor (preserved ${visitCount} visits): ${doc.firstName} ${doc.lastName}`);
      }
    }
  }

  // 4. Load JSON doctors payload
  const jsonPath = path.join(__dirname, 'burhanpur_doctors.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`❌ File not found: ${jsonPath}`);
  }
  const doctorsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`\n📋 Loaded ${doctorsData.length} doctors from burhanpur_doctors.json`);

  // 5. Upsert doctors into database
  let insertedCount = 0;
  let updatedCount = 0;

  for (const d of doctorsData) {
    const targetArea = areaMap[d.area] || areaMap['Burhanpur'];

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
      hqId: burhanpurHq.id,
      territoryId: burhanpurHq.id,
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

  // 6. Verification Summary
  const totalBurhanpurDocs = await prisma.doctor.count({
    where: { hqId: burhanpurHq.id, deletedAt: null }
  });
  console.log(`\n📊 Verification: Total Active Doctors in Burhanpur HQ: ${totalBurhanpurDocs}`);

  const byArea = await prisma.doctor.groupBy({
    by: ['areaId'],
    where: { hqId: burhanpurHq.id, deletedAt: null },
    _count: true
  });
  console.log('   Breakdown by Area:');
  for (const b of byArea) {
    const a = Object.values(areaMap).find(x => x.id === b.areaId);
    console.log(`   - ${a ? a.name : b.areaId}: ${b._count} doctors`);
  }

  const bySpec = await prisma.doctor.groupBy({
    by: ['specialty'],
    where: { hqId: burhanpurHq.id, deletedAt: null },
    _count: true,
    orderBy: { _count: { specialty: 'desc' } }
  });
  console.log('   Breakdown by Specialty:');
  for (const s of bySpec) {
    console.log(`   - ${s.specialty}: ${s._count} doctors`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Error during import:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
