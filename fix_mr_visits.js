require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const mr = await prisma.user.findUnique({ where: { email: 'mr@pharmax.com' } });
  if (!mr) return console.log('mr not found');
  
  const update = await prisma.visit.updateMany({
    where: { 
      userId: mr.id,
      status: { in: ['CHECKED_IN', 'PREPARING', 'ENGAGING', 'DETAILING'] }
    },
    data: {
      status: 'PLANNED'
    }
  });
  console.log(`Updated ${update.count} visits to PLANNED for MR.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
