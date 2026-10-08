require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Connecting to database...');
    // 1. Add PAUSED to VisitStatus enum if not present
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t 
          JOIN pg_enum e ON t.oid = e.enumtypid 
          WHERE t.typname = 'VisitStatus' AND e.enumlabel = 'PAUSED'
        ) THEN
          ALTER TYPE "VisitStatus" ADD VALUE 'PAUSED';
          RAISE NOTICE 'Added PAUSED to VisitStatus enum';
        END IF;
      END$$;
    `);

    // 2. Add columns to visits table if not present
    await pool.query(`
      ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
      ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "pauseReason" TEXT;
      ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "totalPausedMinutes" INTEGER DEFAULT 0;
    `);

    console.log('Migration successful: PAUSED enum & pause tracking columns are ready.');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
