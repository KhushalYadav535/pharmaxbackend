require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const visits = await prisma.visit.findMany({ 
    where: { status: { in: ['CHECKED_IN', 'PREPARING', 'ENGAGING', 'DETAILING'] } },
    include: { user: { select: { email: true } } }
  });
  console.log('--- ALL ACTIVE VISITS ---');
  console.log(JSON.stringify(visits.map(v => ({ id: v.id, type: v.visitType, status: v.status, email: v.user.email })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
