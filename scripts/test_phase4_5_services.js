require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

async function testPhase4And5() {
  const connectionString = (process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/pharma');
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('--- Testing Phase 4 & 5 DB and Services ---');

    // 1. Documents
    const docCount = await prisma.employeeDocument.count();
    console.log('Employee documents count:', docCount);

    // 2. Incentive Plans
    const plans = await prisma.incentivePlan.findMany();
    console.log(`Incentive Plans count: ${plans.length}`);
    plans.forEach(p => console.log(`  - [${p.code}] ${p.name} (Base: ${p.baseIncentiveRate}%, Super: ${p.superIncentiveRate}%)`));

    // 3. Incentive Calculations
    const calcs = await prisma.incentiveCalculation.findMany({
      include: { user: { select: { firstName: true, lastName: true, role: true } } }
    });
    console.log(`Incentive Calculations count: ${calcs.length}`);
    calcs.forEach(c => console.log(`  - User: ${c.user.firstName} ${c.user.lastName} (${c.user.role}) | Period: ${c.period} | Target: ₹${c.targetAmount} | Achieved: ₹${c.achievedAmount} (${c.achievementPercent}%) | Incentive: ₹${c.finalAmount}`));

    // 4. Expenses with HRMS columns
    const expenses = await prisma.expense.findMany({
      take: 3,
      select: { id: true, amount: true, claimCategory: true, approvalStatus: true }
    });
    console.log('Sample expenses with claimCategory:', expenses);

    console.log('✓ All Phase 4 & 5 database models and relations verified successfully!');
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testPhase4And5();
