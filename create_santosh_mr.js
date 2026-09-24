require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Setting up MR Santosh Telang in Indore Headquarter...\n');

  // 1. Locate Indore Headquarter
  let indoreHq = await prisma.territory.findFirst({
    where: {
      OR: [
        { code: 'HQ-INDORE' },
        { name: { equals: 'Indore', mode: 'insensitive' } }
      ]
    }
  });

  if (!indoreHq) {
    indoreHq = await prisma.territory.create({
      data: {
        code: 'HQ-INDORE',
        name: 'Indore',
        state: 'Madhya Pradesh',
        region: 'MP-West',
        zone: 'Central',
        district: 'Indore',
        pinCode: '452001'
      }
    });
    console.log(`✅ Created Indore HQ: ${indoreHq.name} (${indoreHq.id})`);
  } else {
    console.log(`✅ Found Indore HQ: ${indoreHq.name} (Code: ${indoreHq.code}, ID: ${indoreHq.id})`);
  }

  // 2. Hash Password
  const passwordHash = await bcrypt.hash('password123', 10);

  // 3. Upsert User
  const email = 'santoshtelang@gmail.com'.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  let user;
  if (existingUser) {
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        firstName: 'Santosh',
        lastName: 'Telang',
        role: 'MR',
        designation: 'Medical Representative',
        department: 'Sales & Commercial',
        passwordHash,
        hqId: indoreHq.id,
        isActive: true,
        deletedAt: null
      }
    });
    console.log(`🔄 Updated existing user: ${user.firstName} ${user.lastName} (${user.email})`);
  } else {
    // Generate unique employeeId
    const count = await prisma.user.count();
    const employeeId = `EMP${String(count + 1).padStart(3, '0')}`;

    user = await prisma.user.create({
      data: {
        employeeId,
        email,
        passwordHash,
        firstName: 'Santosh',
        lastName: 'Telang',
        phone: '+91 98765 43210',
        role: 'MR',
        designation: 'Medical Representative',
        department: 'Sales & Commercial',
        hqId: indoreHq.id,
        isActive: true
      }
    });
    console.log(`✨ Created new MR: ${user.firstName} ${user.lastName} (${user.email}) with ID: ${user.employeeId}`);
  }

  // 4. Link Primary Territory (Indore)
  const existingUt = await prisma.userTerritory.findFirst({
    where: {
      userId: user.id,
      territoryId: indoreHq.id
    }
  });

  if (!existingUt) {
    await prisma.userTerritory.create({
      data: {
        userId: user.id,
        territoryId: indoreHq.id,
        isPrimary: true
      }
    });
    console.log(`📍 Assigned Indore territory to ${user.firstName} ${user.lastName}`);
  } else {
    await prisma.userTerritory.update({
      where: { id: existingUt.id },
      data: { isPrimary: true }
    });
    console.log(`📍 Updated territory assignment for ${user.firstName} ${user.lastName}`);
  }

  console.log('\n🎉 MR User Santosh Telang successfully configured!');
  console.log(`   📧 Email:    ${user.email}`);
  console.log(`   🔑 Password: password123`);
  console.log(`   👔 Role:     ${user.role}`);
  console.log(`   🏢 HQ:       ${indoreHq.name} (${indoreHq.code})`);
}

main()
  .catch((err) => {
    console.error('❌ Error configuring MR Santosh Telang:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
