require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const hqConfigs = [
  { code: 'HQ-INDORE', name: 'Indore', state: 'Madhya Pradesh', region: 'MP-West', zone: 'Central' },
  { code: 'HQ-DHAR', name: 'Dhar', state: 'Madhya Pradesh', region: 'MP-West', zone: 'Central' },
  { code: 'HQ-UJJAIN', name: 'Ujjain', state: 'Madhya Pradesh', region: 'MP-West', zone: 'Central' },
  { code: 'HQ-BURHANPUR', name: 'Burhanpur', state: 'Madhya Pradesh', region: 'MP-South', zone: 'Central' },
  { code: 'HQ-KHARGOAN', name: 'Khargoan', state: 'Madhya Pradesh', region: 'MP-South', zone: 'Central' },
  { code: 'HQ-NAGPUR', name: 'Nagpur', state: 'Maharashtra', region: 'Vidarbha', zone: 'West' },
  { code: 'HQ-YAVATMAL', name: 'Yavatmal', state: 'Maharashtra', region: 'Vidarbha', zone: 'West' },
  { code: 'HQ-AKOLA', name: 'Akola', state: 'Maharashtra', region: 'Vidarbha', zone: 'West' },
  { code: 'HQ-WARDHA', name: 'Wardha', state: 'Maharashtra', region: 'Vidarbha', zone: 'West' },
];

const employees = [
  {
    empCode: 'EMP999',
    firstName: 'System',
    lastName: 'Admin',
    email: 'admin@pharmax.com',
    phone: '+91 98765 43210',
    role: 'SUPER_ADMIN',
    designation: 'Administrator',
    hqCode: 'HQ-INDORE',
  },
  {
    empCode: 'EMP001',
    firstName: 'Nishant',
    lastName: 'Gothane',
    email: 'info@biocrospharma.in',
    phone: '+91 94799 90000',
    role: 'SUPER_ADMIN',
    designation: 'Managing Director',
    hqCode: 'HQ-INDORE',
  },
  {
    empCode: 'EMP002',
    firstName: 'Azhar',
    lastName: 'Shamim',
    email: 'azharshamim68@gmail.com',
    phone: '+91 97524 65331',
    role: 'RSM',
    designation: 'Regional Sales Manager',
    hqCode: 'HQ-INDORE',
  },
  {
    empCode: 'EMP003',
    firstName: 'Ashish',
    lastName: 'Shrivas',
    email: 'biocrosashish@gmail.com',
    phone: '+91 93022 40298',
    role: 'ASM',
    designation: 'Area Sales Manager',
    hqCode: 'HQ-INDORE',
  },
  {
    empCode: 'EMP004',
    firstName: 'Hitesh',
    lastName: 'Kumbhare',
    email: 'hitesh2026@gmail.com',
    phone: '+91 70456 53901',
    role: 'ASM',
    designation: 'Area Sales Manager',
    hqCode: 'HQ-INDORE',
  },
  {
    empCode: 'EMP005',
    firstName: 'Dheeraj',
    lastName: 'Daporkar',
    email: 'daporkardheeraj@gmail.com',
    phone: '+91 98262 31571',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-DHAR',
  },
  {
    empCode: 'EMP006',
    firstName: 'Sourabh',
    lastName: 'Uplawdiya',
    email: 'sourabhuplawdiya@gmail.com',
    phone: '+91 96175 38482',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-INDORE',
  },
  {
    empCode: 'EMP007',
    firstName: 'Shyam Lal',
    lastName: 'Dangi',
    email: 'shyammba.dangi@gmail.com',
    phone: '+91 83493 33311',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-INDORE',
  },
  {
    empCode: 'EMP008',
    firstName: 'Sameer',
    lastName: 'Khan',
    email: 'mohdsameer0724@gmail.com',
    phone: '+91 84358 31086',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-UJJAIN',
  },
  {
    empCode: 'EMP009',
    firstName: 'Subham',
    lastName: 'Patil',
    email: 'subhampatil255726@gmail.com',
    phone: '+91 96178 51115',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-BURHANPUR',
  },
  {
    empCode: 'EMP015',
    firstName: 'Shubham',
    lastName: 'Patil',
    email: 'shubhampatil255726@gmail.com',
    phone: '+91 96178 51115',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-BURHANPUR',
  },
  {
    empCode: 'EMP010',
    firstName: 'Jitendra Singh',
    lastName: 'Sengar',
    email: 'jitu.thakur04@gmail.com',
    phone: '+91 75665 55014',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-KHARGOAN',
  },
  {
    empCode: 'EMP011',
    firstName: 'Vijay D',
    lastName: 'Ludhekar',
    email: 'vijayludhekar123@gmail.com',
    phone: '+91 77740 45782',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-NAGPUR',
  },
  {
    empCode: 'EMP012',
    firstName: 'Ziya W',
    lastName: 'Khan',
    email: 'kziya4600@gmail.com',
    phone: '+91 99211 40750',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-YAVATMAL',
  },
  {
    empCode: 'EMP013',
    firstName: 'Yashvant Namdeorao',
    lastName: 'Bhuibhar',
    email: 'ynbhuibhar@gmail.com',
    phone: '+91 90112 26680',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-AKOLA',
  },
  {
    empCode: 'EMP014',
    firstName: 'Jaya D',
    lastName: 'Wandhare',
    email: 'jayabhandakkar@gmail.com',
    phone: '+91 98236 63800',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-WARDHA',
  },
  {
    empCode: 'EMP016',
    firstName: 'Santosh',
    lastName: 'Telang',
    email: 'santoshtelang@gmail.com',
    phone: '+91 98765 00000',
    role: 'MR',
    designation: 'Medical Representative',
    hqCode: 'HQ-INDORE',
  },
];

async function main() {
  console.log('🚀 Setting up / Syncing All Biocros Employees & Login Credentials...\n');

  // 1. Ensure all HQ Territories exist
  const territoryMap = {};
  for (const cfg of hqConfigs) {
    let t = await prisma.territory.findFirst({
      where: {
        OR: [
          { code: cfg.code },
          { name: { equals: cfg.name, mode: 'insensitive' } }
        ]
      }
    });

    if (!t) {
      t = await prisma.territory.create({
        data: {
          code: cfg.code,
          name: cfg.name,
          state: cfg.state,
          region: cfg.region,
          zone: cfg.zone,
        }
      });
      console.log(`📍 Created Territory: ${t.name} (${t.code})`);
    } else {
      console.log(`📍 Found Territory: ${t.name} (${t.code})`);
    }
    territoryMap[cfg.code] = t;
    territoryMap[cfg.name.toUpperCase()] = t;
  }

  // 2. Hash default password
  const defaultPassword = 'password123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 3. Upsert each employee
  let createdCount = 0;
  let updatedCount = 0;

  for (const emp of employees) {
    const email = emp.email.trim().toLowerCase();
    const hq = territoryMap[emp.hqCode] || territoryMap['HQ-INDORE'];

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(emp.empCode ? [{ employeeId: emp.empCode }] : [])
        ]
      }
    });

    let user;
    if (existingUser) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          firstName: emp.firstName,
          lastName: emp.lastName,
          email,
          role: emp.role,
          designation: emp.designation,
          department: 'Sales & Commercial',
          passwordHash, // Reset/set password to password123
          hqId: hq.id,
          isActive: true,
          deletedAt: null,
          phone: emp.phone,
        }
      });
      updatedCount++;
      console.log(`🔄 Updated Employee: ${user.firstName} ${user.lastName} (${user.email}, Role: ${user.role}, HQ: ${hq.name})`);
    } else {
      user = await prisma.user.create({
        data: {
          employeeId: emp.empCode,
          email,
          passwordHash,
          firstName: emp.firstName,
          lastName: emp.lastName,
          phone: emp.phone,
          role: emp.role,
          designation: emp.designation,
          department: 'Sales & Commercial',
          hqId: hq.id,
          isActive: true,
        }
      });
      createdCount++;
      console.log(`✨ Created Employee: ${user.firstName} ${user.lastName} (${user.email}, Role: ${user.role}, HQ: ${hq.name})`);
    }

    // Link Primary UserTerritory
    const existingUt = await prisma.userTerritory.findFirst({
      where: { userId: user.id, territoryId: hq.id }
    });

    if (!existingUt) {
      await prisma.userTerritory.create({
        data: {
          userId: user.id,
          territoryId: hq.id,
          isPrimary: true,
        }
      });
    } else if (!existingUt.isPrimary) {
      await prisma.userTerritory.update({
        where: { id: existingUt.id },
        data: { isPrimary: true }
      });
    }
  }

  console.log(`\n=====================================================`);
  console.log(`🎉 EMPLOYEES SETUP COMPLETE!`);
  console.log(`   - Created: ${createdCount}`);
  console.log(`   - Updated/Password Reset: ${updatedCount}`);
  console.log(`   - Total Employees: ${employees.length}`);
  console.log(`   - Default Password: ${defaultPassword}`);
  console.log(`=====================================================\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to seed employees:', err);
  process.exit(1);
});
