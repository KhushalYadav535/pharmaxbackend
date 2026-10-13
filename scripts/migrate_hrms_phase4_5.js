require('dotenv').config();
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

async function migratePhase4And5() {
  const connectionString = (process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/pharma').replace('?schema=public', '');
  const pool = new Pool({ connectionString });

  try {
    console.log('--- Starting Safe HRMS Phase 4 & 5 Migration ---');
    console.log('Connecting to database...');

    // 1. Safe alterations to expenses table
    await pool.query(`
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "claimCategory" VARCHAR(64) DEFAULT 'TA_DA';
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "settledById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL;
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "managerRemarks" TEXT;
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "tourPlanId" VARCHAR(64) REFERENCES "tour_plans"("id") ON DELETE SET NULL;
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "visitId" VARCHAR(64) REFERENCES "visits"("id") ON DELETE SET NULL;
    `);
    console.log('✓ Table expenses enhanced with HRMS settlement & audit fields.');

    // 2. Create table employee_documents (Module 12)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "employee_documents" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "category" VARCHAR(64) NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "documentNumber" VARCHAR(128),
        "fileUrl" TEXT NOT NULL,
        "fileType" VARCHAR(64),
        "fileSize" INTEGER,
        "issueDate" TIMESTAMP(3),
        "expiryDate" TIMESTAMP(3),
        "status" VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
        "verifiedById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
        "verifiedAt" TIMESTAMP(3),
        "uploadedById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
        "isConfidential" BOOLEAN NOT NULL DEFAULT false,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "emp_doc_user_idx" ON "employee_documents"("userId");
      CREATE INDEX IF NOT EXISTS "emp_doc_category_idx" ON "employee_documents"("category");
      CREATE INDEX IF NOT EXISTS "emp_doc_expiry_idx" ON "employee_documents"("expiryDate");
    `);
    console.log('✓ Table employee_documents verified / created.');

    // 3. Create table incentive_plans (Module 14)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "incentive_plans" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(64) NOT NULL UNIQUE,
        "periodType" VARCHAR(32) NOT NULL DEFAULT 'MONTHLY',
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "minTargetAchievementPct" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
        "minCallCoveragePct" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
        "baseIncentiveRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
        "superIncentiveRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
        "applicableRole" VARCHAR(64) DEFAULT 'MR',
        "divisionId" VARCHAR(64) REFERENCES "divisions"("id") ON DELETE SET NULL,
        "description" TEXT,
        "status" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "inc_plan_code_idx" ON "incentive_plans"("code");
    `);
    console.log('✓ Table incentive_plans verified / created.');

    // 4. Create table incentive_calculations (Module 14)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "incentive_calculations" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "planId" VARCHAR(64) NOT NULL REFERENCES "incentive_plans"("id") ON DELETE CASCADE,
        "period" VARCHAR(32) NOT NULL,
        "targetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "achievedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "achievementPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "callsPlanned" INTEGER NOT NULL DEFAULT 0,
        "callsCompleted" INTEGER NOT NULL DEFAULT 0,
        "callCoveragePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "calculatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "finalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "status" VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
        "approvedById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
        "approvedAt" TIMESTAMP(3),
        "paidAt" TIMESTAMP(3),
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        CONSTRAINT "unique_user_incentive_period" UNIQUE ("userId", "planId", "period")
      );
      CREATE INDEX IF NOT EXISTS "inc_calc_user_period_idx" ON "incentive_calculations"("userId", "period");
      CREATE INDEX IF NOT EXISTS "inc_calc_status_idx" ON "incentive_calculations"("status");
    `);
    console.log('✓ Table incentive_calculations verified / created.');

    // 5. Seed default Incentive Schemes
    const defaultPlans = [
      {
        name: 'Quarterly Commercial Excellence Incentive (Q3/Q4)',
        code: 'COMM_EXC_2026',
        periodType: 'QUARTERLY',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.999Z',
        minTarget: 80.0,
        minCallCoverage: 85.0,
        baseRate: 6.0,
        superRate: 12.0,
        desc: 'Core field incentive driven by sales target achievement and doctor visit coverage consistency.',
      },
      {
        name: 'New Cardio & Diabeto Launch Drive',
        code: 'NEW_LAUNCH_2026',
        periodType: 'MONTHLY',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-11-30T23:59:59.999Z',
        minTarget: 75.0,
        minCallCoverage: 80.0,
        baseRate: 8.0,
        superRate: 15.0,
        desc: 'Special launch acceleration scheme for flagship cardiovascular line promotions.',
      },
    ];

    for (const p of defaultPlans) {
      const existing = await pool.query('SELECT id FROM "incentive_plans" WHERE "code" = $1', [p.code]);
      if (existing.rowCount === 0) {
        await pool.query(`
          INSERT INTO "incentive_plans" (
            "id", "name", "code", "periodType", "startDate", "endDate",
            "minTargetAchievementPct", "minCallCoveragePct", "baseIncentiveRate",
            "superIncentiveRate", "description", "status"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        `, [
          randomUUID(), p.name, p.code, p.periodType, p.startDate, p.endDate,
          p.minTarget, p.minCallCoverage, p.baseRate, p.superRate, p.desc
        ]);
        console.log(`+ Seeded incentive plan: ${p.name} (${p.code})`);
      }
    }

    // 6. Seed sample calculation for active field representatives for 2026-09 & 2026-10
    const planRes = await pool.query('SELECT id FROM "incentive_plans" WHERE "code" = $1', ['COMM_EXC_2026']);
    if (planRes.rowCount > 0) {
      const planId = planRes.rows[0].id;
      const mrs = await pool.query(`SELECT id, "firstName", "lastName" FROM "users" WHERE role = 'MR' LIMIT 5`);
      for (const mr of mrs.rows) {
        const period = '2026-09';
        const check = await pool.query('SELECT id FROM "incentive_calculations" WHERE "userId" = $1 AND "planId" = $2 AND "period" = $3', [mr.id, planId, period]);
        if (check.rowCount === 0) {
          const target = 250000;
          const achieved = 285000;
          const pct = Math.round((achieved / target) * 100);
          const incAmount = Math.round(achieved * 0.06);
          await pool.query(`
            INSERT INTO "incentive_calculations" (
              "id", "userId", "planId", "period", "targetAmount", "achievedAmount",
              "achievementPercent", "callsPlanned", "callsCompleted", "callCoveragePercent",
              "calculatedAmount", "finalAmount", "status", "notes"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 120, 114, 95.0, $8, $8, 'APPROVED', 'Performance target exceeded.')
          `, [randomUUID(), mr.id, planId, period, target, achieved, pct, incAmount]);
        }
      }
      console.log('✓ Seeded sample incentive performance calculations for field MRs.');
    }

    console.log('--- Phase 4 & 5 Database Migration Complete with ZERO data loss ---');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

migratePhase4And5();
