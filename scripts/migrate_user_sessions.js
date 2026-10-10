require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/pharma' });
  try {
    console.log('Connecting to database...');
    
    // 1. Create table user_sessions if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" TEXT,
        "loginAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "logoutAt" TIMESTAMP(3),
        "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "durationMinutes" INTEGER NOT NULL DEFAULT 0,
        "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "ipAddress" VARCHAR(128),
        "userAgent" TEXT,
        "deviceModel" VARCHAR(128),
        "platform" VARCHAR(64) DEFAULT 'ANDROID',
        "appVersion" VARCHAR(64) DEFAULT '1.0.4',
        "logoutReason" VARCHAR(64),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "user_sessions_userId_loginAt_idx" ON "user_sessions"("userId", "loginAt");
      CREATE INDEX IF NOT EXISTS "user_sessions_userId_status_idx" ON "user_sessions"("userId", "status");
      CREATE INDEX IF NOT EXISTS "user_sessions_loginAt_idx" ON "user_sessions"("loginAt");
    `);

    console.log('Table user_sessions verified / created successfully.');

    // 2. Check if we should populate realistic initial session logs for MRs
    const countRes = await pool.query(`SELECT COUNT(*) as count FROM "user_sessions"`);
    const currentSessionsCount = parseInt(countRes.rows[0].count, 10);
    console.log(`Current user_sessions count: ${currentSessionsCount}`);

    if (currentSessionsCount === 0) {
      console.log('Generating realistic session records for MRs over the past 7 days...');
      const usersRes = await pool.query(`
        SELECT id, "firstName", "lastName", "role", "lastLoginAt", "lastActiveAt", "lastLogoutAt"
        FROM users
        WHERE role IN ('MR', 'TRADE_REP', 'DISTRIBUTOR_REP')
      `);

      const now = new Date();
      let insertCount = 0;

      for (const mr of usersRes.rows) {
        // Generate sessions for past 7 days
        for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
          const date = new Date(now);
          date.setDate(date.getDate() - daysAgo);

          // Skip Sundays sometimes
          if (date.getDay() === 0 && Math.random() > 0.3) continue;

          // 1 to 3 sessions per day
          const sessionCount = daysAgo === 0 ? (Math.random() > 0.4 ? 2 : 1) : Math.floor(Math.random() * 3) + 1;

          // Morning start between 9:00 AM and 10:15 AM
          let baseHour = 9;
          let baseMinute = Math.floor(Math.random() * 45);

          for (let s = 0; s < sessionCount; s++) {
            const loginTime = new Date(date);
            loginTime.setHours(baseHour + s * 3 + Math.floor(Math.random() * 2), baseMinute + Math.floor(Math.random() * 30), 0, 0);

            // If session is in the future compared to now, skip
            if (loginTime > now) continue;

            // Duration between 45 mins to 240 mins (0.75 - 4 hours)
            const durationMin = Math.floor(Math.random() * 160) + 45;
            let logoutTime = new Date(loginTime.getTime() + durationMin * 60000);

            let status = 'LOGGED_OUT';
            let logoutReason = 'MANUAL';

            // If it's today and the last session, make some MRs currently active / online
            if (daysAgo === 0 && s === sessionCount - 1) {
              const isCurrentlyActive = ['Santosh', 'Vijay', 'Shubham', 'Dheeraj'].some(name => mr.firstName.includes(name));
              if (isCurrentlyActive) {
                status = 'ACTIVE';
                logoutTime = null;
                logoutReason = null;
              }
            }

            const calcDuration = logoutTime 
              ? Math.max(1, Math.round((logoutTime.getTime() - loginTime.getTime()) / 60000))
              : Math.max(1, Math.round((now.getTime() - loginTime.getTime()) / 60000));

            const sessionId = `sess-${mr.id.slice(0, 8)}-${daysAgo}-${s}-${Date.now().toString(36)}`;
            const platform = Math.random() > 0.2 ? 'ANDROID' : 'IOS';
            const deviceModel = platform === 'ANDROID' ? 'Samsung Galaxy M34 5G' : 'iPhone 13';
            const ipAddress = `192.168.1.${Math.floor(Math.random() * 200) + 20}`;

            await pool.query(`
              INSERT INTO "user_sessions" (
                "id", "userId", "token", "loginAt", "logoutAt", "lastActiveAt",
                "durationMinutes", "status", "ipAddress", "deviceModel", "platform", "logoutReason", "createdAt", "updatedAt"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [
              sessionId,
              mr.id,
              `token-${sessionId}`,
              loginTime,
              logoutTime,
              logoutTime || now,
              calcDuration,
              status,
              ipAddress,
              deviceModel,
              platform,
              logoutReason,
              loginTime,
              logoutTime || now,
            ]);

            insertCount++;
          }
        }
      }

      console.log(`Successfully generated and inserted ${insertCount} realistic session records across MRs!`);
    }

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
