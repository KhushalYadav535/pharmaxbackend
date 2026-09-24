require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Nagpur Doctor List Import...\n');

  // 1. Locate or Create Nagpur Territory (Headquarter)
  let nagpurHq = await prisma.territory.findFirst({
    where: {
      OR: [
        { code: 'HQ-NAGPUR' },
        { name: { equals: 'Nagpur', mode: 'insensitive' } }
      ]
    }
  });

  if (!nagpurHq) {
    nagpurHq = await prisma.territory.create({
      data: {
        code: 'HQ-NAGPUR',
        name: 'Nagpur',
        district: 'Nagpur',
        state: 'Maharashtra',
        region: 'Vidarbha',
        zone: 'West',
        pinCode: '440001'
      }
    });
    console.log(`✅ Created new Nagpur Headquarter: ${nagpurHq.name} (Code: ${nagpurHq.code}, ID: ${nagpurHq.id})`);
  } else {
    console.log(`✅ Found Nagpur HQ: ${nagpurHq.name} (Code: ${nagpurHq.code}, ID: ${nagpurHq.id})`);
  }

  // Ensure Nagpur MR (Vijay D Ludhekar) is linked to Nagpur HQ
  try {
    const nagpurMr = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: 'vijayludhekar123@gmail.com', mode: 'insensitive' } },
          { employeeId: 'EMP011' },
          { firstName: { contains: 'VIJAY', mode: 'insensitive' } }
        ]
      }
    });

    if (nagpurMr) {
      await prisma.user.update({
        where: { id: nagpurMr.id },
        data: { hqId: nagpurHq.id }
      });

      const existingUt = await prisma.userTerritory.findFirst({
        where: { userId: nagpurMr.id, territoryId: nagpurHq.id }
      });
      if (!existingUt) {
        await prisma.userTerritory.create({
          data: { userId: nagpurMr.id, territoryId: nagpurHq.id }
        });
      }
      console.log(`👤 Successfully linked Nagpur MR: ${nagpurMr.firstName} ${nagpurMr.lastName} (${nagpurMr.email}) to Nagpur HQ!`);
    }
  } catch (mrErr) {
    console.log('⚠️ Could not link Nagpur MR automatically:', mrErr.message);
  }


  // 2. Setup / Verify Sub-Area for Nagpur HQ
  let nagpurArea = await prisma.area.findFirst({
    where: {
      OR: [
        { areaCode: 'AREA-NAGP' },
        { hqId: nagpurHq.id, name: { equals: 'Nagpur Central Area', mode: 'insensitive' } }
      ]
    }
  });

  if (!nagpurArea) {
    nagpurArea = await prisma.area.create({
      data: {
        areaCode: 'AREA-NAGP',
        name: 'Nagpur Central Area',
        district: 'Nagpur',
        state: 'Maharashtra',
        pinCode: '440001',
        hqId: nagpurHq.id,
        isActive: true
      }
    });
    console.log(`📍 Created new Area: ${nagpurArea.name} (Code: ${nagpurArea.areaCode}, ID: ${nagpurArea.id})`);
  } else {
    // Ensure district, state, and hqId are set
    await prisma.area.update({
      where: { id: nagpurArea.id },
      data: { hqId: nagpurHq.id, district: 'Nagpur', state: 'Maharashtra', pinCode: '440001', isActive: true }
    });
    console.log(`📍 Found & updated Area: ${nagpurArea.name} (ID: ${nagpurArea.id})`);
  }

  // 3. Remove initial placeholder mock doctors in Nagpur HQ safely
  const dummyDocIds = [
    '757f8507-e638-41fe-954b-958452c7579d', // Rajesh Sharma
    '1e0910f3-0720-4b0a-b34b-58035bce4b3e', // Sunil Verma
    'a5c925e3-2516-4964-a645-897e00c02fea', // Rajesh Sharma
    '63068842-8d07-445d-821c-2b44d63e3e60', // Sunil Verma
  ];
  for (const dummyId of dummyDocIds) {
    try {
      const doc = await prisma.doctor.findUnique({ where: { id: dummyId } });
      if (doc && doc.hqId === nagpurHq.id) {
        await prisma.doctor.update({
          where: { id: dummyId },
          data: { isActive: false, deletedAt: new Date() }
        });
        console.log(`🔒 Deactivated placeholder doctor: ${doc.firstName} ${doc.lastName} (${dummyId})`);
      }
    } catch (e) {
      console.log(`⚠️ Skipped dummy cleanup for ${dummyId}:`, e.message);
    }
  }

  try {
    const remainingDummies = await prisma.doctor.findMany({
      where: {
        hqId: nagpurHq.id,
        doctorCode: null,
        OR: [
          { firstName: 'Rajesh', lastName: 'Sharma' },
          { firstName: 'Sunil', lastName: 'Verma' }
        ]
      }
    });
    for (const dummy of remainingDummies) {
      await prisma.doctor.update({
        where: { id: dummy.id },
        data: { isActive: false, deletedAt: new Date() }
      });
      console.log(`🔒 Deactivated un-coded dummy doctor: ${dummy.firstName} ${dummy.lastName} (${dummy.id})`);
    }
  } catch (e) {
    console.log('⚠️ Skipped remaining dummies cleanup:', e.message);
  }

  // 4. Load JSON doctors payload
  const jsonPath = path.join(__dirname, 'nagpur_doctors.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`❌ File not found: ${jsonPath}`);
  }
  const doctorsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`\n📋 Loaded ${doctorsData.length} doctors from nagpur_doctors.json`);

  // 5. Upsert doctors into database
  let insertedCount = 0;
  let updatedCount = 0;

  for (const d of doctorsData) {
    const doctorPayload = {
      doctorCode: d.doctorCode,
      salutation: d.salutation || 'Dr.',
      firstName: d.firstName,
      middleName: d.middleName || null,
      lastName: d.lastName,
      specialty: d.specialty,
      qualification: d.qualification,
      classification: d.classification || 'A',
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
      hqId: nagpurHq.id,
      territoryId: nagpurHq.id,
      areaId: nagpurArea.id,
      visitFrequency: 2,
      approvalStatus: 'APPROVED',
      isActive: true,
    };

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

  console.log(`\n🎉 Import completed successfully!`);
  console.log(`   ✨ New Doctors Inserted: ${insertedCount}`);
  console.log(`   🔄 Existing Doctors Updated: ${updatedCount}`);

  // 6. Summary verification
  const totalNagpurDocs = await prisma.doctor.count({
    where: { hqId: nagpurHq.id, isActive: true, deletedAt: null }
  });
  console.log(`\n📊 Total Active Doctors in Nagpur HQ: ${totalNagpurDocs}`);

  const specialtyBreakdown = await prisma.doctor.groupBy({
    by: ['specialty'],
    where: { hqId: nagpurHq.id, isActive: true, deletedAt: null },
    _count: true
  });
  console.log('\n📊 Breakdown by Specialty in Nagpur:');
  specialtyBreakdown.forEach(s => console.log(`   • ${s.specialty}: ${s._count}`));

  const categoryBreakdown = await prisma.doctor.groupBy({
    by: ['category'],
    where: { hqId: nagpurHq.id, isActive: true, deletedAt: null },
    _count: true
  });
  console.log('\n📊 Breakdown by Category in Nagpur:');
  categoryBreakdown.forEach(c => console.log(`   • ${c.category}: ${c._count}`));
}

main()
  .catch((err) => {
    console.error('❌ Import failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
