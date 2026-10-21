const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:root@localhost:5432/pharma?schema=public";
  const pool = new Pool({ connectionString });

  console.log('Adding interiorId column to doctors table...');
  await pool.query(`
    ALTER TABLE "doctors" 
    ADD COLUMN IF NOT EXISTS "interiorId" TEXT 
    REFERENCES "interiors"("id") ON DELETE SET NULL;
  `);

  console.log('Adding interiorId column to tour_plan_days table...');
  await pool.query(`
    ALTER TABLE "tour_plan_days" 
    ADD COLUMN IF NOT EXISTS "interiorId" TEXT 
    REFERENCES "interiors"("id") ON DELETE SET NULL;
  `);

  console.log('Columns added successfully.');
  await pool.end();
}

main().catch(err => {
  console.error('Error adding columns:', err);
  process.exit(1);
});
