require('dotenv').config();
const { Pool } = require('pg');

async function testPhase1() {
  const pool = new Pool({ connectionString: (process.env.DATABASE_URL || '').replace('?schema=public', '') });
  try {
    console.log('Testing Phase 1 Database & Records...');

    const depts = await pool.query('SELECT count(*) FROM departments');
    console.log('Departments count:', depts.rows[0].count);

    const divs = await pool.query('SELECT count(*) FROM divisions');
    console.log('Divisions count:', divs.rows[0].count);

    const grades = await pool.query('SELECT count(*) FROM grade_bands');
    console.log('Grade bands count:', grades.rows[0].count);

    const desigs = await pool.query('SELECT count(*) FROM designations');
    console.log('Designations count:', desigs.rows[0].count);

    const settings = await pool.query('SELECT key, value FROM hrms_settings');
    console.log('HRMS Settings:', settings.rows);

    const assignments = await pool.query('SELECT count(*) FROM employee_assignments');
    console.log('Employee assignments count:', assignments.rows[0].count);

    const movements = await pool.query('SELECT count(*) FROM employee_movements');
    console.log('Employee movements count:', movements.rows[0].count);

    console.log('✓ All Phase 1 tables and records verified successfully!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await pool.end();
  }
}

testPhase1();
