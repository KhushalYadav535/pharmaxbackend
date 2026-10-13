require('dotenv').config();
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

async function migratePhase2And3() {
  const connectionString = (process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/pharma').replace('?schema=public', '');
  const pool = new Pool({ connectionString });

  try {
    console.log('--- Starting Safe HRMS Phase 2 & 3 Migration ---');
    console.log('Connecting to database...');

    // 1. Alter attendances table safely (non-destructive)
    await pool.query(`
      ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "checkOutLat" DOUBLE PRECISION;
      ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "checkOutLng" DOUBLE PRECISION;
      ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "checkOutAddress" TEXT;
      ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;
      ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "isRegularized" BOOLEAN DEFAULT false;
      ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "regularizationId" VARCHAR(64);
    `);
    console.log('✓ Table attendances enhanced with checkout, duration, and regularization fields.');

    // 2. Create table attendance_regularizations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "attendance_regularizations" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "attendanceId" VARCHAR(64) REFERENCES "attendances"("id") ON DELETE SET NULL,
        "attendanceDate" TIMESTAMP(3) NOT NULL,
        "regularizationType" VARCHAR(64) NOT NULL,
        "requestedCheckIn" TIMESTAMP(3),
        "requestedCheckOut" TIMESTAMP(3),
        "reason" TEXT NOT NULL,
        "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        "managerRemarks" TEXT,
        "approvedById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
        "approvedAt" TIMESTAMP(3),
        "hrApprovedById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
        "hrApprovedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "att_reg_user_date_idx" ON "attendance_regularizations"("userId", "attendanceDate");
      CREATE INDEX IF NOT EXISTS "att_reg_status_idx" ON "attendance_regularizations"("status");
    `);
    console.log('✓ Table attendance_regularizations verified / created.');

    // 3. Create table leave_types
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "leave_types" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(128) NOT NULL,
        "code" VARCHAR(32) NOT NULL UNIQUE,
        "daysAllowedPerYear" DOUBLE PRECISION NOT NULL DEFAULT 12,
        "carryForwardLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "isPaid" BOOLEAN NOT NULL DEFAULT true,
        "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
        "minNoticeDays" INTEGER DEFAULT 0,
        "maxConsecutiveDays" INTEGER DEFAULT 15,
        "description" TEXT,
        "status" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "leave_types_code_idx" ON "leave_types"("code");
    `);
    console.log('✓ Table leave_types verified / created.');

    // 4. Create table leave_balances
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "leave_balances" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "leaveTypeId" VARCHAR(64) NOT NULL REFERENCES "leave_types"("id") ON DELETE CASCADE,
        "year" INTEGER NOT NULL DEFAULT 2026,
        "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "accrued" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "closingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        CONSTRAINT "unique_user_leave_year" UNIQUE ("userId", "leaveTypeId", "year")
      );
      CREATE INDEX IF NOT EXISTS "leave_bal_user_year_idx" ON "leave_balances"("userId", "year");
    `);
    console.log('✓ Table leave_balances verified / created.');

    // 5. Enhance leaves table safely
    await pool.query(`
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "leaveTypeId" VARCHAR(64) REFERENCES "leave_types"("id") ON DELETE SET NULL;
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "isHalfDay" BOOLEAN DEFAULT false;
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "halfDaySession" VARCHAR(32);
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "totalDays" DOUBLE PRECISION DEFAULT 1.0;
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "supportingDocUrl" TEXT;
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "approvedById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL;
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "hrApprovedById" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL;
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "hrApprovalStatus" VARCHAR(32);
      ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "managerRemarks" TEXT;
    `);
    console.log('✓ Table leaves enhanced with HRMS fields.');

    // 6. Create table holidays
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "holidays" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(128) NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "holidayType" VARCHAR(32) NOT NULL DEFAULT 'NATIONAL',
        "state" VARCHAR(64),
        "divisionId" VARCHAR(64) REFERENCES "divisions"("id") ON DELETE SET NULL,
        "isOptional" BOOLEAN NOT NULL DEFAULT false,
        "status" BOOLEAN NOT NULL DEFAULT true,
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "holidays_date_idx" ON "holidays"("date");
    `);
    console.log('✓ Table holidays verified / created.');

    // 7. Seed standard Leave Types
    const standardLeaveTypes = [
      { code: 'CL', name: 'Casual Leave', days: 12, carry: 0, isPaid: true, reqDoc: false, desc: 'Casual unforeseen personal commitments' },
      { code: 'SL', name: 'Sick Leave', days: 10, carry: 0, isPaid: true, reqDoc: true, desc: 'Medical and sickness leave' },
      { code: 'EL', name: 'Earned / Privilege Leave', days: 15, carry: 15, isPaid: true, reqDoc: false, desc: 'Annual privilege earned leave' },
      { code: 'COMP_OFF', name: 'Compensatory Off', days: 0, carry: 0, isPaid: true, reqDoc: false, desc: 'Compensatory off for working on non-working days' },
      { code: 'LWP', name: 'Leave Without Pay', days: 0, carry: 0, isPaid: false, reqDoc: false, desc: 'Unpaid sabbatical or extraordinary leave' },
    ];

    for (const lt of standardLeaveTypes) {
      const existing = await pool.query('SELECT id FROM "leave_types" WHERE "code" = $1', [lt.code]);
      if (existing.rowCount === 0) {
        await pool.query(`
          INSERT INTO "leave_types" ("id", "name", "code", "daysAllowedPerYear", "carryForwardLimit", "isPaid", "requiresDocument", "description", "status")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        `, [randomUUID(), lt.name, lt.code, lt.days, lt.carry, lt.isPaid, lt.reqDoc, lt.desc]);
        console.log(`+ Seeded leave type: ${lt.name} (${lt.code})`);
      }
    }

    // 8. Seed Holidays for 2026
    const standardHolidays = [
      { name: 'Republic Day', date: '2026-01-26T00:00:00.000Z', type: 'NATIONAL', desc: 'Republic Day of India' },
      { name: 'Maha Shivratri', date: '2026-02-15T00:00:00.000Z', type: 'REGIONAL', desc: 'Maha Shivratri' },
      { name: 'Holi', date: '2026-03-04T00:00:00.000Z', type: 'NATIONAL', desc: 'Festival of Colours' },
      { name: 'Id-ul-Fitr', date: '2026-03-21T00:00:00.000Z', type: 'NATIONAL', desc: 'Eid-ul-Fitr' },
      { name: 'Mahavir Jayanti', date: '2026-03-31T00:00:00.000Z', type: 'REGIONAL', desc: 'Mahavir Jayanti' },
      { name: 'Good Friday', date: '2026-04-03T00:00:00.000Z', type: 'NATIONAL', desc: 'Good Friday' },
      { name: 'Dr. Ambedkar Jayanti', date: '2026-04-14T00:00:00.000Z', type: 'NATIONAL', desc: 'Dr B.R. Ambedkar Jayanti' },
      { name: 'May Day / Labor Day', date: '2026-05-01T00:00:00.000Z', type: 'COMPANY', desc: 'International Workers Day' },
      { name: 'Independence Day', date: '2026-08-15T00:00:00.000Z', type: 'NATIONAL', desc: 'Independence Day of India' },
      { name: 'Janmashtami', date: '2026-09-04T00:00:00.000Z', type: 'REGIONAL', desc: 'Krishna Janmashtami' },
      { name: 'Mahatma Gandhi Jayanti', date: '2026-10-02T00:00:00.000Z', type: 'NATIONAL', desc: 'Gandhi Jayanti' },
      { name: 'Dussehra (Vijay Dashami)', date: '2026-10-20T00:00:00.000Z', type: 'NATIONAL', desc: 'Dussehra' },
      { name: 'Diwali (Deepavali)', date: '2026-11-08T00:00:00.000Z', type: 'NATIONAL', desc: 'Diwali Festival' },
      { name: 'Guru Nanak Jayanti', date: '2026-11-24T00:00:00.000Z', type: 'NATIONAL', desc: 'Guru Nanak Jayanti' },
      { name: 'Christmas Day', date: '2026-12-25T00:00:00.000Z', type: 'NATIONAL', desc: 'Christmas' },
    ];

    for (const h of standardHolidays) {
      const existing = await pool.query('SELECT id FROM "holidays" WHERE "name" = $1 AND "date" = $2', [h.name, h.date]);
      if (existing.rowCount === 0) {
        await pool.query(`
          INSERT INTO "holidays" ("id", "name", "date", "holidayType", "description", "status")
          VALUES ($1, $2, $3, $4, $5, true)
        `, [randomUUID(), h.name, h.date, h.type, h.desc]);
      }
    }
    console.log('✓ 2026 Holiday calendar verified / seeded.');

    // 9. Seed Work Timings Settings into hrms_settings
    const timingSettings = [
      { key: 'work_start_time_standard', value: '09:30', desc: 'Standard field start time' },
      { key: 'work_end_time_standard', value: '18:00', desc: 'Standard field day end time' },
      { key: 'late_grace_minutes', value: '30', desc: 'Grace period minutes before late start exception is flagged' },
      { key: 'half_day_min_duration_minutes', value: '240', desc: 'Minimum field duration in minutes for half-day credit' },
      { key: 'full_day_min_duration_minutes', value: '480', desc: 'Minimum field duration in minutes for full-day credit' },
    ];
    for (const s of timingSettings) {
      await pool.query(`
        INSERT INTO "hrms_settings" ("id", "key", "value", "description")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("key") DO NOTHING
      `, [randomUUID(), s.key, s.value, s.desc]);
    }
    console.log('✓ Timing and duration policies seeded into hrms_settings.');

    // 10. Seed Leave Balances for all active employees for 2026
    const usersRes = await pool.query('SELECT id, "firstName", "lastName" FROM "users" WHERE "deletedAt" IS NULL');
    const leaveTypesRes = await pool.query('SELECT id, code, "daysAllowedPerYear" FROM "leave_types" WHERE "status" = true');
    const currentYear = 2026;

    let balancesCreated = 0;
    for (const u of usersRes.rows) {
      for (const lt of leaveTypesRes.rows) {
        const check = await pool.query(
          'SELECT id FROM "leave_balances" WHERE "userId" = $1 AND "leaveTypeId" = $2 AND "year" = $3',
          [u.id, lt.id, currentYear]
        );
        if (check.rowCount === 0) {
          const quota = Number(lt.daysAllowedPerYear) || 0;
          await pool.query(`
            INSERT INTO "leave_balances" ("id", "userId", "leaveTypeId", "year", "openingBalance", "accrued", "used", "pending", "closingBalance")
            VALUES ($1, $2, $3, $4, $5, 0, 0, 0, $5)
          `, [randomUUID(), u.id, lt.id, currentYear, quota]);
          balancesCreated++;
        }
      }
    }
    console.log(`✓ Seeded ${balancesCreated} initial leave balance records for current employees.`);

    console.log('--- Phase 2 & 3 Migration Complete with ZERO data loss ---');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

migratePhase2And3();
