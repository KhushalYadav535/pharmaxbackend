require('dotenv').config();
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

async function migratePhase1() {
  const connectionString = (process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/pharma').replace('?schema=public', '');
  const pool = new Pool({ connectionString });

  try {
    console.log('--- Starting Safe HRMS Phase 1 Migration ---');
    console.log('Connecting to database...');

    // 1. Create table departments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "departments" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(128) NOT NULL,
        "code" VARCHAR(64) NOT NULL UNIQUE,
        "headId" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
        "status" BOOLEAN NOT NULL DEFAULT true,
        "effectiveDate" TIMESTAMP(3) DEFAULT NOW(),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "departments_code_idx" ON "departments"("code");
    `);
    console.log('✓ Table departments verified / created.');

    // 2. Create table divisions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "divisions" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(128) NOT NULL,
        "code" VARCHAR(64) NOT NULL UNIQUE,
        "businessUnit" VARCHAR(128),
        "status" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "divisions_code_idx" ON "divisions"("code");
    `);
    console.log('✓ Table divisions verified / created.');

    // 3. Create table grade_bands
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "grade_bands" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(128) NOT NULL,
        "code" VARCHAR(64) NOT NULL UNIQUE,
        "level" INTEGER DEFAULT 1,
        "description" TEXT,
        "status" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "grade_bands_code_idx" ON "grade_bands"("code");
    `);
    console.log('✓ Table grade_bands verified / created.');

    // 4. Create table designations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "designations" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(128) NOT NULL,
        "code" VARCHAR(64) NOT NULL UNIQUE,
        "gradeBandId" VARCHAR(64) REFERENCES "grade_bands"("id") ON DELETE SET NULL,
        "departmentId" VARCHAR(64) REFERENCES "departments"("id") ON DELETE SET NULL,
        "status" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "designations_code_idx" ON "designations"("code");
    `);
    console.log('✓ Table designations verified / created.');

    // 5. Create table hrms_settings (for configurable approval policies & workflows)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "hrms_settings" (
        "id" VARCHAR(64) PRIMARY KEY,
        "key" VARCHAR(128) NOT NULL UNIQUE,
        "value" TEXT NOT NULL,
        "description" TEXT,
        "updatedBy" VARCHAR(64),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ Table hrms_settings verified / created.');

    // 6. Safe alterations to users table
    await pool.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employmentStatus" VARCHAR(32) DEFAULT 'ACTIVE';
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employmentType" VARCHAR(32) DEFAULT 'PERMANENT';
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "departmentId" VARCHAR(64) REFERENCES "departments"("id") ON DELETE SET NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "divisionId" VARCHAR(64) REFERENCES "divisions"("id") ON DELETE SET NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "designationId" VARCHAR(64) REFERENCES "designations"("id") ON DELETE SET NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gradeBandId" VARCHAR(64) REFERENCES "grade_bands"("id") ON DELETE SET NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dateOfConfirmation" TIMESTAMP(3);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dateOfExit" TIMESTAMP(3);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergencyContactName" VARCHAR(128);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" VARCHAR(32);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergencyContactRelation" VARCHAR(64);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "noticePeriodDays" INTEGER DEFAULT 30;

      CREATE INDEX IF NOT EXISTS "users_employmentStatus_idx" ON "users"("employmentStatus");
      CREATE INDEX IF NOT EXISTS "users_departmentId_idx" ON "users"("departmentId");
      CREATE INDEX IF NOT EXISTS "users_divisionId_idx" ON "users"("divisionId");
    `);
    console.log('✓ Users table columns safely added / verified.');

    // 7. Create table employee_assignments (effective-dated territory & HQ allocations)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "employee_assignments" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "divisionId" VARCHAR(64) REFERENCES "divisions"("id") ON DELETE SET NULL,
        "regionId" VARCHAR(64),
        "areaId" VARCHAR(64) REFERENCES "areas"("id") ON DELETE SET NULL,
        "hqId" VARCHAR(64) REFERENCES "territories"("id") ON DELETE SET NULL,
        "territoryId" VARCHAR(64) REFERENCES "territories"("id") ON DELETE SET NULL,
        "managerId" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
        "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "effectiveTo" TIMESTAMP(3),
        "isCurrent" BOOLEAN NOT NULL DEFAULT true,
        "reason" TEXT,
        "assignedById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "employee_assignments_userId_isCurrent_idx" ON "employee_assignments"("userId", "isCurrent");
      CREATE INDEX IF NOT EXISTS "employee_assignments_hqId_idx" ON "employee_assignments"("hqId");
      CREATE INDEX IF NOT EXISTS "employee_assignments_territoryId_idx" ON "employee_assignments"("territoryId");
    `);
    console.log('✓ Table employee_assignments verified / created.');

    // 8. Create table employee_movements (lifecycle promotions, transfers, resignations)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "employee_movements" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "movementType" VARCHAR(64) NOT NULL,
        "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "previousValue" TEXT,
        "newValue" TEXT,
        "reason" TEXT,
        "status" VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
        "approvedById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
        "supportingDocUrl" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "employee_movements_userId_idx" ON "employee_movements"("userId");
      CREATE INDEX IF NOT EXISTS "employee_movements_movementType_idx" ON "employee_movements"("movementType");
      CREATE INDEX IF NOT EXISTS "employee_movements_effectiveDate_idx" ON "employee_movements"("effectiveDate");
    `);
    console.log('✓ Table employee_movements verified / created.');

    // 9. Seed default standard Masters if empty
    const deptCount = await pool.query(`SELECT COUNT(*) FROM "departments"`);
    if (parseInt(deptCount.rows[0].count, 10) === 0) {
      console.log('Seeding initial pharmaceutical departments...');
      const depts = [
        { code: 'SALES', name: 'Sales & Marketing' },
        { code: 'MED_AFF', name: 'Medical Affairs' },
        { code: 'OPS', name: 'Field Operations' },
        { code: 'HR', name: 'Human Resources' },
        { code: 'SUPPLY', name: 'Supply Chain & Logistics' },
      ];
      for (const d of depts) {
        await pool.query(
          `INSERT INTO "departments" (id, code, name, status) VALUES ($1, $2, $3, true)`,
          [randomUUID(), d.code, d.name]
        );
      }
    }

    const divCount = await pool.query(`SELECT COUNT(*) FROM "divisions"`);
    if (parseInt(divCount.rows[0].count, 10) === 0) {
      console.log('Seeding initial pharmaceutical divisions...');
      const divs = [
        { code: 'DIV_PHARMA', name: 'General Pharma', bu: 'Primary Care' },
        { code: 'DIV_ACUTE', name: 'Acute Care Division', bu: 'Specialty' },
        { code: 'DIV_CHRONIC', name: 'Chronic & Cardio-Diabetic', bu: 'Specialty' },
        { code: 'DIV_DERMA', name: 'Dermatology & Cosmetology', bu: 'Derma' },
        { code: 'DIV_OTC', name: 'Consumer Health / OTC', bu: 'Consumer' },
      ];
      for (const div of divs) {
        await pool.query(
          `INSERT INTO "divisions" (id, code, name, "businessUnit", status) VALUES ($1, $2, $3, $4, true)`,
          [randomUUID(), div.code, div.name, div.bu]
        );
      }
    }

    const gradeCount = await pool.query(`SELECT COUNT(*) FROM "grade_bands"`);
    if (parseInt(gradeCount.rows[0].count, 10) === 0) {
      console.log('Seeding initial grade bands...');
      const grades = [
        { code: 'G1', name: 'G1 - Field Executive (MR)', level: 1, desc: 'Medical Representatives' },
        { code: 'G2', name: 'G2 - Senior Field Executive', level: 2, desc: 'Senior MRs / Field Specialists' },
        { code: 'G3', name: 'G3 - First Line Manager (ASM)', level: 3, desc: 'Area Sales Managers' },
        { code: 'G4', name: 'G4 - Second Line Manager (RSM)', level: 4, desc: 'Regional Sales Managers' },
        { code: 'G5', name: 'G5 - Zonal / Business Manager (ZM)', level: 5, desc: 'Zonal Managers' },
        { code: 'G6', name: 'G6 - National Leadership (NSM/VP)', level: 6, desc: 'National Sales Managers & Heads' },
      ];
      for (const g of grades) {
        await pool.query(
          `INSERT INTO "grade_bands" (id, code, name, level, description, status) VALUES ($1, $2, $3, $4, $5, true)`,
          [randomUUID(), g.code, g.name, g.level, g.desc]
        );
      }
    }

    const desigCount = await pool.query(`SELECT COUNT(*) FROM "designations"`);
    if (parseInt(desigCount.rows[0].count, 10) === 0) {
      console.log('Seeding initial designations...');
      const desigs = [
        { code: 'MR', name: 'Medical Representative' },
        { code: 'SR_MR', name: 'Senior Medical Representative' },
        { code: 'ASM', name: 'Area Sales Manager' },
        { code: 'RSM', name: 'Regional Sales Manager' },
        { code: 'ZM', name: 'Zonal Manager' },
        { code: 'NSM', name: 'National Sales Manager' },
        { code: 'PM', name: 'Product Manager' },
        { code: 'HR_ADMIN', name: 'HR Admin' },
      ];
      for (const ds of desigs) {
        await pool.query(
          `INSERT INTO "designations" (id, code, name, status) VALUES ($1, $2, $3, true)`,
          [randomUUID(), ds.code, ds.name]
        );
      }
    }

    // Default HRMS approval settings
    await pool.query(`
      INSERT INTO "hrms_settings" ("id", "key", "value", "description")
      VALUES
        ($1, 'leave_approval_workflow', 'DIRECT_MANAGER', 'Workflow level: DIRECT_MANAGER (Level 1) or TWO_LEVEL (ASM -> HR)'),
        ($2, 'regularization_approval_workflow', 'DIRECT_MANAGER', 'Workflow level: DIRECT_MANAGER or TWO_LEVEL'),
        ($3, 'allow_negative_leave_balance', 'false', 'Allow leave submission if balance is zero'),
        ($4, 'block_day_start_on_approved_leave', 'true', 'Prevent MR from starting day if approved leave exists')
      ON CONFLICT ("key") DO NOTHING;
    `, [randomUUID(), randomUUID(), randomUUID(), randomUUID()]);
    console.log('✓ Default HRMS approval settings verified / seeded.');

    // 10. Initial Backfill: If users have hqId or user_territories, ensure an initial EmployeeAssignment exists
    const usersWithHq = await pool.query(`
      SELECT u.id, u."hqId", u."managerId", ut."territoryId"
      FROM users u
      LEFT JOIN user_territories ut ON ut."userId" = u.id AND ut."isPrimary" = true
      WHERE u.id NOT IN (SELECT "userId" FROM employee_assignments)
    `);

    if (usersWithHq.rows.length > 0) {
      console.log(`Backfilling initial assignment for ${usersWithHq.rows.length} existing users...`);
      for (const u of usersWithHq.rows) {
        await pool.query(`
          INSERT INTO "employee_assignments"
          ("id", "userId", "hqId", "territoryId", "managerId", "isCurrent", "reason", "effectiveFrom")
          VALUES ($1, $2, $3, $4, $5, true, 'Initial Migration Assignment', NOW())
        `, [randomUUID(), u.id, u.hqId || null, u.territoryId || u.hqId || null, u.managerId || null]);
      }
      console.log('✓ Initial assignments populated safely.');
    }

    console.log('\n--- HRMS Phase 1 Safe Migration COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migratePhase1();
