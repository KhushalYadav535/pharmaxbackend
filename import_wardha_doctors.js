require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Wardha Doctor List Import...\n');

  // 1. Locate or Create Wardha Territory (Headquarter)
  let wardhaHq = await prisma.territory.findFirst({
    where: {
      OR: [
        { code: 'HQ-WARDHA' },
        { name: { equals: 'Wardha', mode: 'insensitive' } }
      ]
    }
  });

  if (!wardhaHq) {
    wardhaHq = await prisma.territory.create({
      data: {
        code: 'HQ-WARDHA',
        name: 'Wardha',
        district: 'Wardha',
        state: 'Maharashtra',
        region: 'Vidarbha',
        zone: 'West',
        pinCode: '442001'
      }
    });
    console.log(`✅ Created new Wardha Headquarter: ${wardhaHq.name} (Code: ${wardhaHq.code}, ID: ${wardhaHq.id})`);
  } else {
    // Update fields if missing
    wardhaHq = await prisma.territory.update({
      where: { id: wardhaHq.id },
      data: {
        district: 'Wardha',
        state: 'Maharashtra',
        region: 'Vidarbha',
        zone: 'West',
        pinCode: '442001'
      }
    });
    console.log(`✅ Found Wardha HQ: ${wardhaHq.name} (Code: ${wardhaHq.code}, ID: ${wardhaHq.id})`);
  }

  // 2. Ensure Wardha MR (Jaya D Wandhare) is linked to Wardha HQ
  try {
    const wardhaMrs = await prisma.user.findMany({
      where: {
        OR: [
          { email: { equals: 'jayabhandakkar@gmail.com', mode: 'insensitive' } },
          { employeeId: 'EMP014' },
          { lastName: { contains: 'WANDHARE', mode: 'insensitive' } }
        ]
      }
    });

    for (const mr of wardhaMrs) {
      await prisma.user.update({
        where: { id: mr.id },
        data: { hqId: wardhaHq.id }
      });

      const existingUt = await prisma.userTerritory.findFirst({
        where: { userId: mr.id, territoryId: wardhaHq.id }
      });
      if (!existingUt) {
        await prisma.userTerritory.create({
          data: { userId: mr.id, territoryId: wardhaHq.id }
        });
      }
      console.log(`👤 Linked Wardha MR: ${mr.firstName} ${mr.lastName} (${mr.email}) to Wardha HQ`);
    }
  } catch (mrErr) {
    console.log('⚠️ Could not link Wardha MR automatically:', mrErr.message);
  }

  // 3. Setup Areas for Wardha HQ
  const areaConfigs = [
    { name: 'Wardha', code: 'AREA-WARD-CITY', district: 'Wardha', state: 'Maharashtra', pinCode: '442001' },
    { name: 'Hinganghat', code: 'AREA-WARD-HINGANGHAT', district: 'Wardha', state: 'Maharashtra', pinCode: '442301' },
    { name: 'Arvi', code: 'AREA-WARD-ARVI', district: 'Wardha', state: 'Maharashtra', pinCode: '442201' },
    { name: 'Pulgaon - Rohna', code: 'AREA-WARD-PULGAON', district: 'Wardha', state: 'Maharashtra', pinCode: '442302' },
    { name: 'Deoli', code: 'AREA-WARD-DEOLI', district: 'Wardha', state: 'Maharashtra', pinCode: '442101' },
    { name: 'Samudrapur - Girad', code: 'AREA-WARD-SAMUDRAPUR', district: 'Wardha', state: 'Maharashtra', pinCode: '442905' },
    { name: 'Sindhi - Kelzar', code: 'AREA-WARD-SINDHI', district: 'Wardha', state: 'Maharashtra', pinCode: '442107' },
    { name: 'Selu - Hingni', code: 'AREA-WARD-SELU', district: 'Wardha', state: 'Maharashtra', pinCode: '442104' },
    { name: 'Alipur - Wadner', code: 'AREA-WARD-ALIPUR', district: 'Wardha', state: 'Maharashtra', pinCode: '442304' },
    { name: 'Wadner', code: 'AREA-WARD-WADNER', district: 'Wardha', state: 'Maharashtra', pinCode: '442307' },
    { name: 'Karmya', code: 'AREA-WARD-KARMYA', district: 'Wardha', state: 'Maharashtra', pinCode: '442203' },
    { name: 'Nandore - Kora', code: 'AREA-WARD-KORA', district: 'Wardha', state: 'Maharashtra', pinCode: '442907' },
  ];

  const areaMap = {};

  // Check if existing "Wardha Central Area" exists, we can rename it to "Wardha"
  const existingCentralArea = await prisma.area.findFirst({
    where: { hqId: wardhaHq.id, name: 'Wardha Central Area' }
  });
  if (existingCentralArea) {
    const updated = await prisma.area.update({
      where: { id: existingCentralArea.id },
      data: {
        name: 'Wardha',
        areaCode: 'AREA-WARD-CITY',
        district: 'Wardha',
        state: 'Maharashtra',
        pinCode: '442001',
        isActive: true
      }
    });
    areaMap['AREA-WARD-CITY'] = updated;
    areaMap['Wardha'] = updated;
    console.log(`📍 Renamed existing "Wardha Central Area" -> "Wardha" (${updated.id})`);
  }

  for (const cfg of areaConfigs) {
    if (areaMap[cfg.code]) continue;

    let area = await prisma.area.findFirst({
      where: {
        OR: [
          { areaCode: cfg.code },
          { hqId: wardhaHq.id, name: { equals: cfg.name, mode: 'insensitive' } }
        ]
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
          hqId: wardhaHq.id,
          isActive: true
        }
      });
      console.log(`📍 Created Area: ${area.name} (${area.areaCode})`);
    } else {
      area = await prisma.area.update({
        where: { id: area.id },
        data: {
          areaCode: cfg.code,
          name: cfg.name,
          district: cfg.district,
          state: cfg.state,
          pinCode: cfg.pinCode,
          hqId: wardhaHq.id,
          isActive: true
        }
      });
      console.log(`📍 Verified Area: ${area.name} (${area.areaCode})`);
    }

    areaMap[cfg.code] = area;
    areaMap[cfg.name] = area;
  }

  // 4. Clean up placeholder uncoded dummy doctors in Wardha HQ
  try {
    const dummies = await prisma.doctor.findMany({
      where: {
        hqId: wardhaHq.id,
        doctorCode: null,
        OR: [
          { firstName: 'Rajesh', lastName: 'Sharma' },
          { firstName: 'Sunil', lastName: 'Verma' }
        ]
      }
    });
    for (const dummy of dummies) {
      await prisma.doctor.update({
        where: { id: dummy.id },
        data: { isActive: false, deletedAt: new Date() }
      });
      console.log(`🔒 Deactivated placeholder doctor: ${dummy.firstName} ${dummy.lastName} (${dummy.id})`);
    }
  } catch (cleanErr) {
    console.log('⚠️ Note on dummy doctor cleanup:', cleanErr.message);
  }

  // 5. Load JSON doctors payload
  const jsonPath = path.join(__dirname, 'wardha_doctors.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`❌ File not found: ${jsonPath}`);
  }
  const doctorsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`\n📋 Loaded ${doctorsData.length} doctors from wardha_doctors.json`);

  // 6. Upsert doctors into database
  let insertedCount = 0;
  let updatedCount = 0;

  for (const d of doctorsData) {
    const assignedArea = areaMap[d.areaCode] || areaMap[d.area] || areaMap['AREA-WARD-CITY'];

    const doctorPayload = {
      doctorCode: d.doctorCode,
      salutation: d.salutation || 'Dr.',
      firstName: d.firstName,
      middleName: d.middleName || null,
      lastName: d.lastName,
      specialty: d.specialty,
      qualification: d.qualification,
      classification: d.classification || 'B',
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
      hqId: wardhaHq.id,
      territoryId: wardhaHq.id,
      areaId: assignedArea ? assignedArea.id : null,
      visitFrequency: 2,
      approvalStatus: 'APPROVED',
      isActive: true,
      deletedAt: null,
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

  console.log(`\n🎉 Wardha Doctor Import completed successfully!`);
  console.log(`   ✨ New Doctors Inserted: ${insertedCount}`);
  console.log(`   🔄 Existing Doctors Updated: ${updatedCount}`);

  // 7. Summary verification
  const totalWardhaDocs = await prisma.doctor.count({
    where: { hqId: wardhaHq.id, isActive: true, deletedAt: null }
  });
  console.log(`\n📊 Total Active Doctors in Wardha HQ: ${totalWardhaDocs}`);

  const specialtyBreakdown = await prisma.doctor.groupBy({
    by: ['specialty'],
    where: { hqId: wardhaHq.id, isActive: true, deletedAt: null },
    _count: true
  });
  console.log('\n📊 Breakdown by Specialty in Wardha:');
  specialtyBreakdown.sort((a,b) => b._count - a._count).forEach(s => console.log(`   • ${s.specialty}: ${s._count}`));

  const areaBreakdown = await prisma.doctor.groupBy({
    by: ['areaId'],
    where: { hqId: wardhaHq.id, isActive: true, deletedAt: null },
    _count: true
  });
  console.log('\n📊 Breakdown by Area in Wardha:');
  for (const ab of areaBreakdown) {
    const areaRecord = Object.values(areaMap).find(a => a && a.id === ab.areaId);
    console.log(`   • ${areaRecord ? areaRecord.name : ab.areaId}: ${ab._count}`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Import failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
