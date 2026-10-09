const fs = require('fs');
const path = require('path');

const PROD_API = 'https://pharmax-api.santiently.com/api/v1';

async function run() {
  console.log('🚀 Starting import of 50 Nagpur Doctors to Production API...\n');

  // 1. Login as Admin
  const loginRes = await fetch(`${PROD_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'info@biocrospharma.in', password: 'password123' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    throw new Error(`Login failed: ${loginData.message}`);
  }
  const token = loginData.data.accessToken;
  console.log('🔑 Authenticated successfully as Super Admin');

  // 2. Fetch Nagpur HQ
  const hqRes = await fetch(`${PROD_API}/headquarters`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const hqData = await hqRes.json();
  const nagpurHq = (hqData.data?.headquarters || []).find(h => h.code === 'HQ-NAGPUR' || h.name.toLowerCase() === 'nagpur');
  if (!nagpurHq) {
    throw new Error('Nagpur HQ not found in production!');
  }
  console.log(`📍 Found Nagpur HQ: ${nagpurHq.name} (${nagpurHq.id})`);

  // 3. Fetch Nagpur Area
  const areaRes = await fetch(`${PROD_API}/areas`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const areaData = await areaRes.json();
  const nagpurArea = (areaData.data?.areas || []).find(a => a.areaCode === 'AREA-NAGP' || a.name.toLowerCase().includes('nagpur central'));
  if (!nagpurArea) {
    throw new Error('Nagpur Area not found in production!');
  }
  console.log(`📍 Found Nagpur Area: ${nagpurArea.name} (${nagpurArea.id})`);

  // 4. Soft-delete the 2 dummy placeholder doctors
  const existingDocsRes = await fetch(`${PROD_API}/doctors?hqId=${nagpurHq.id}&approvalStatus=ALL&limit=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const existingDocsData = await existingDocsRes.json();
  const dummyDocs = (existingDocsData.data?.doctors || []).filter(d => !d.doctorCode || d.doctorCode.startsWith('DOC-TEST'));

  for (const dummy of dummyDocs) {
    console.log(`🗑️ Deactivating dummy placeholder doctor: ${dummy.firstName} ${dummy.lastName} (${dummy.id})...`);
    const delRes = await fetch(`${PROD_API}/doctors/${dummy.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const delData = await delRes.json();
    console.log(`   Status: ${delData.success ? 'Deactivated' : delData.message}`);
  }

  // 5. Load nagpur_doctors.json
  const jsonPath = path.join(__dirname, 'nagpur_doctors.json');
  const doctorsList = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`\n📋 Loaded ${doctorsList.length} doctors from nagpur_doctors.json`);

  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const doc of doctorsList) {
    const payload = {
      doctorCode: doc.doctorCode,
      salutation: doc.salutation || 'Dr.',
      firstName: doc.firstName,
      middleName: doc.middleName || null,
      lastName: doc.lastName,
      specialty: doc.specialty,
      qualification: doc.qualification,
      classification: doc.classification || 'A',
      category: doc.category,
      prescriber: true,
      prescriptionPotential: 40000,
      phone: doc.phone,
      whatsappNumber: doc.whatsappNumber,
      email: doc.email,
      address: doc.address || 'Nagpur, Maharashtra',
      address1: doc.address1 || 'Nagpur, Maharashtra',
      city: doc.city || 'Nagpur',
      district: doc.district || 'Nagpur',
      state: doc.state || 'Maharashtra',
      pincode: doc.pincode || '440001',
      hqId: nagpurHq.id,
      territoryId: nagpurHq.id,
      areaId: nagpurArea.id,
      visitFrequency: doc.visitFrequency || 2,
      approvalStatus: 'APPROVED',
      isActive: true,
    };

    try {
      const res = await fetch(`${PROD_API}/doctors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        createdCount++;
        process.stdout.write(`✅ [${createdCount}/${doctorsList.length}] Created ${doc.doctorCode}: Dr. ${doc.firstName} ${doc.lastName}\n`);
      } else {
        console.error(`❌ Failed ${doc.doctorCode}: ${data.message}`);
        failedCount++;
      }
    } catch (err) {
      console.error(`❌ Error creating ${doc.doctorCode}: ${err.message}`);
      failedCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`🎉 Import Summary:`);
  console.log(`   Created: ${createdCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`========================================\n`);

  // 6. Verification
  const verifyRes = await fetch(`${PROD_API}/doctors?hqId=${nagpurHq.id}&approvalStatus=ALL&limit=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const verifyData = await verifyRes.json();
  console.log(`📊 Production Verification - Nagpur Doctors Total: ${verifyData.data?.total || 0}`);
  console.log(`📊 Doctors in this page: ${(verifyData.data?.doctors || []).length}`);
  
  // Verify stats endpoint for Nagpur MR
  const mrLoginRes = await fetch(`${PROD_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vijayludhekar123@gmail.com', password: 'password123' })
  });
  const mrLoginData = await mrLoginRes.json();
  if (mrLoginData.success) {
    const mrToken = mrLoginData.data.accessToken;
    const mrDocsRes = await fetch(`${PROD_API}/doctors?approvalStatus=ALL&limit=100`, {
      headers: { Authorization: `Bearer ${mrToken}` }
    });
    const mrDocsData = await mrDocsRes.json();
    console.log(`👤 Nagpur MR (Vijay D Ludhekar) Doctor Visibility Count: ${mrDocsData.data?.total || 0}`);
  }
}

run().catch(console.error);
