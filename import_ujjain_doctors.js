require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Ujjain Doctor List Import...\n');

  // 1. Locate Ujjain Territory (Headquarter)
  let ujjainHq = await prisma.territory.findFirst({
    where: {
      OR: [
        { code: 'HQ-UJJAIN' },
        { name: { equals: 'Ujjain', mode: 'insensitive' } }
      ]
    }
  });

  if (!ujjainHq) {
    throw new Error('❌ Ujjain Headquarter (HQ-UJJAIN) territory not found in database!');
  }
  console.log(`✅ Found Ujjain HQ: ${ujjainHq.name} (Code: ${ujjainHq.code}, ID: ${ujjainHq.id})`);

  // 2. Setup Areas for Ujjain HQ
  const areaConfigs = [
    { name: 'Ujjain', district: 'Ujjain', state: 'Madhya Pradesh', pinCode: '456010' },
    { name: 'Barnagar', district: 'Ujjain', state: 'Madhya Pradesh', pinCode: '456771' },
    { name: 'Shajapur', district: 'Shajapur', state: 'Madhya Pradesh', pinCode: '465001' },
    { name: 'Nagda', district: 'Ujjain', state: 'Madhya Pradesh', pinCode: '456335' },
    { name: 'Agar', district: 'Agar Malwa', state: 'Madhya Pradesh', pinCode: '465441' },
  ];

  const areaMap = {};

  // Check if existing "Ujjain Central Area" exists, we can rename it to "Ujjain"
  const existingCentralArea = await prisma.area.findFirst({
    where: { hqId: ujjainHq.id, name: 'Ujjain Central Area' }
  });
  if (existingCentralArea) {
    const updated = await prisma.area.update({
      where: { id: existingCentralArea.id },
      data: { name: 'Ujjain', district: 'Ujjain', state: 'Madhya Pradesh', pinCode: '456010' }
    });
    areaMap['Ujjain'] = updated;
    console.log(`📍 Renamed existing "Ujjain Central Area" -> "Ujjain" (${updated.id})`);
  }

  for (const cfg of areaConfigs) {
    if (areaMap[cfg.name]) continue;
    let area = await prisma.area.findFirst({
      where: {
        hqId: ujjainHq.id,
        name: { equals: cfg.name, mode: 'insensitive' }
      }
    });

    if (!area) {
      const areaCode = `AREA-UJJ-${cfg.name.toUpperCase()}`;
      area = await prisma.area.create({
        data: {
          areaCode,
          name: cfg.name,
          district: cfg.district,
          state: cfg.state,
          pinCode: cfg.pinCode,
          hqId: ujjainHq.id,
          isActive: true
        }
      });
      console.log(`📍 Created new Area: ${area.name} (Code: ${area.areaCode}, ID: ${area.id})`);
    } else {
      console.log(`📍 Found existing Area: ${area.name} (ID: ${area.id})`);
    }
    areaMap[cfg.name] = area;
  }

  // 3. Remove initial placeholder mock doctors in Ujjain HQ if they have 0 visits
  const dummyDocIds = [
    'e1f6e984-0386-4093-9a61-890837bec0b3', // Rajesh Sharma
    '21ec4176-d354-474d-b7d1-84111ef2c6cd', // Sunil Verma
  ];
  for (const dummyId of dummyDocIds) {
    const doc = await prisma.doctor.findUnique({ where: { id: dummyId } });
    if (doc && doc.hqId === ujjainHq.id) {
      const visitCount = await prisma.visit.count({ where: { doctorId: dummyId } });
      if (visitCount === 0) {
        await prisma.doctor.delete({ where: { id: dummyId } });
        console.log(`🗑️ Removed placeholder doctor: ${doc.firstName} ${doc.lastName} (${dummyId})`);
      }
    }
  }

  // 4. Load JSON doctors payload
  const jsonPath = path.join(__dirname, 'ujjain_doctors.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`❌ File not found: ${jsonPath}`);
  }
  const doctorsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`\n📋 Loaded ${doctorsData.length} doctors from ujjain_doctors.json`);

  // 5. Upsert doctors into database
  let insertedCount = 0;
  let updatedCount = 0;

  for (const d of doctorsData) {
    const targetArea = areaMap[d.area] || areaMap['Ujjain'];

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
      prescriptionPotential: 50000,
      phone: d.phone,
      whatsappNumber: d.whatsappNumber,
      email: d.email,
      address: d.address,
      address1: d.address1,
      city: d.city,
      district: d.district,
      state: d.state,
      pincode: d.pincode,
      hqId: ujjainHq.id,
      territoryId: ujjainHq.id,
      areaId: targetArea.id,
      visitFrequency: 2,
      approvalStatus: 'APPROVED',
      isActive: true,
    };

    // Check for existing by doctorCode or (phone + hqId)
    const existing = await prisma.doctor.findFirst({
      where: {
        OR: [
          { doctorCode: d.doctorCode },
          ...(d.phone ? [{ phone: d.phone, hqId: ujjainHq.id }] : [])
        ]
      }
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
  const totalUjjainDocs = await prisma.doctor.count({
    where: { hqId: ujjainHq.id, deletedAt: null }
  });
  console.log(`\n📊 Verification: Total Active Doctors in Ujjain HQ: ${totalUjjainDocs}`);

  const byArea = await prisma.doctor.groupBy({
    by: ['areaId'],
    where: { hqId: ujjainHq.id, deletedAt: null },
    _count: true
  });
  console.log('   Breakdown by Area:');
  for (const b of byArea) {
    const a = Object.values(areaMap).find(x => x.id === b.areaId);
    console.log(`   - ${a ? a.name : b.areaId}: ${b._count} doctors`);
  }

  const bySpec = await prisma.doctor.groupBy({
    by: ['specialty'],
    where: { hqId: ujjainHq.id, deletedAt: null },
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
