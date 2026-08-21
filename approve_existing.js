const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:root@localhost:5432/pharma' });
  await client.connect();
  
  await client.query('UPDATE doctors SET "approvalStatus" = \'APPROVED\'');
  await client.query('UPDATE hospitals SET "approvalStatus" = \'APPROVED\'');
  await client.query('UPDATE stockists SET "approvalStatus" = \'APPROVED\'');
  await client.query('UPDATE retailers SET "approvalStatus" = \'APPROVED\'');
  await client.query('UPDATE distributors SET "approvalStatus" = \'APPROVED\'');
  
  console.log('Done');
  await client.end();
}

main().catch(console.error);
