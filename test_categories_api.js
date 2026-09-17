require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function check() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, name, code, "productNames", color FROM detailing_categories WHERE "isActive" = true ORDER BY name ASC'
  );
  console.log(`✅ Fetched ${rows.length} detailing categories from PostgreSQL:`);
  rows.forEach(r => {
    console.log(`   - [${r.id}] ${r.name} [${r.code}]: ${r.productNames ? r.productNames.length : 0} products mapped`);
  });
}

check()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
