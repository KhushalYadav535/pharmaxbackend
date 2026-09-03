import { PrismaClient, UserRole, DoctorClassification } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export async function runBiocrosSeed() {
  console.log('🚀 [BIOCROS] Starting complete database purge & Biocros migration...');

  // ── 1. PURGE EXISTING DATA (REVERSE FK ORDER) ──────────────────────────────
  console.log('🧹 Purging legacy / test data...');
  await prisma.dayStateLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.retailAudit.deleteMany();
  await prisma.contentView.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.sampleDistribution.deleteMany();
  await prisma.visitAttachment.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.dailyVisitReport.deleteMany();
  await prisma.tourPlanDay.deleteMany();
  await prisma.tourPlan.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.task.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.target.deleteMany();
  await prisma.doctorProduct.deleteMany();
  await prisma.hospitalProduct.deleteMany();
  await prisma.retailerProduct.deleteMany();
  await prisma.cFAProduct.deleteMany();
  await prisma.stockistProduct.deleteMany();
  await prisma.stockReport.deleteMany();
  await prisma.doctorTag.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.hospital.deleteMany();
  await prisma.retailer.deleteMany();
  await prisma.stockist.deleteMany();
  await prisma.distributor.deleteMany();
  await prisma.cFA.deleteMany();
  await prisma.beat.deleteMany();
  await prisma.area.deleteMany();
  await prisma.interior.deleteMany();
  await prisma.location.deleteMany();
  await prisma.product.deleteMany();
  await prisma.sampleProduct.deleteMany();
  await prisma.tradeScheme.deleteMany();
  await prisma.scheme.deleteMany();
  await prisma.trainingModule.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.content.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.userTerritory.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.territory.deleteMany();
  console.log('✅ Database cleanly purged.');

  // ── 2. SEED TERRITORIES (HEADQUARTERS FROM EMPLOYEE LIST) ──────────────────
  console.log('📍 Seeding Headquarters & Territories...');
  const hqList = [
    { code: 'HQ-INDORE', name: 'Indore', state: 'Madhya Pradesh', region: 'MP-West', zone: 'Central' },
    { code: 'HQ-DHAR', name: 'Dhar', state: 'Madhya Pradesh', region: 'MP-West', zone: 'Central' },
    { code: 'HQ-UJJAIN', name: 'Ujjain', state: 'Madhya Pradesh', region: 'MP-West', zone: 'Central' },
    { code: 'HQ-BURHANPUR', name: 'Burhanpur', state: 'Madhya Pradesh', region: 'MP-South', zone: 'Central' },
    { code: 'HQ-KHARGOAN', name: 'Khargoan', state: 'Madhya Pradesh', region: 'MP-South', zone: 'Central' },
    { code: 'HQ-NAGPUR', name: 'Nagpur', state: 'Maharashtra', region: 'Vidarbha', zone: 'West' },
    { code: 'HQ-YAVATMAL', name: 'Yavatmal', state: 'Maharashtra', region: 'Vidarbha', zone: 'West' },
    { code: 'HQ-AKOLA', name: 'Akola', state: 'Maharashtra', region: 'Vidarbha', zone: 'West' },
    { code: 'HQ-WARDHA', name: 'Wardha', state: 'Maharashtra', region: 'Vidarbha', zone: 'West' },
  ];

  const territoryMap: { [hqName: string]: any } = {};
  for (const hq of hqList) {
    const t = await prisma.territory.create({
      data: {
        code: hq.code,
        name: hq.name,
        state: hq.state,
        region: hq.region,
        zone: hq.zone,
      },
    });
    territoryMap[hq.name.toUpperCase()] = t;
  }
  console.log(`✅ ${Object.keys(territoryMap).length} Territories created.`);

  // ── 3. SEED BIOCROS EMPLOYEES ─────────────────────────────────────────────
  console.log('👥 Seeding Biocros Employees with password: password123 ...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // 14 Employees from Excel
  const employeeData = [
    {
      empCode: 'EMP001',
      name: 'NISHANT GOTHANE',
      hq: 'INDORE',
      email: 'info@biocrospharma.in',
      phone: '+91 94799 90000',
      role: UserRole.SUPER_ADMIN,
    },
    {
      empCode: 'EMP002',
      name: 'AZHAR SHAMIM',
      hq: 'INDORE',
      email: 'azharshamim68@gmail.com',
      phone: '+91 97524 65331',
      role: UserRole.RSM,
    },
    {
      empCode: 'EMP003',
      name: 'ASHISH SHRIVAS',
      hq: 'INDORE',
      email: 'biocrosashish@gmail.com',
      phone: '+91 93022 40298',
      role: UserRole.ASM,
    },
    {
      empCode: 'EMP004',
      name: 'HITESH KUMBHARE',
      hq: 'INDORE',
      email: 'hitesh2026@gmail.com',
      phone: '+91 70456 53901',
      role: UserRole.ASM,
    },
    {
      empCode: 'EMP005',
      name: 'DHEERAJ DAPORKAR',
      hq: 'DHAR',
      email: 'daporkardheeraj@gmail.com',
      phone: '+91 98262 31571',
      role: UserRole.MR,
    },
    {
      empCode: 'EMP006',
      name: 'SOURABH UPLAWDIYA',
      hq: 'INDORE',
      email: 'sourabhuplawdiya@gmail.com',
      phone: '+91 96175 38482',
      role: UserRole.MR,
    },
    {
      empCode: 'EMP007',
      name: 'SHYAM LAL DANGI',
      hq: 'INDORE',
      email: 'shayammba.dangi@gmail.com',
      phone: '+91 83493 33311',
      role: UserRole.MR,
    },
    {
      empCode: 'EMP008',
      name: 'SAMEER KHAN',
      hq: 'UJJAIN',
      email: 'mohdsameer0724@gmail.com',
      phone: '+91 84358 31086',
      role: UserRole.MR,
    },
    {
      empCode: 'EMP009',
      name: 'SUBHAM PATIL',
      hq: 'BURHANPUR',
      email: 'subhampatil255726@gmail.com',
      phone: '+91 96178 51115',
      role: UserRole.MR,
    },
    {
      empCode: 'EMP010',
      name: 'JITENDRA SINGH SENGAR',
      hq: 'KHARGOAN',
      email: 'jitu.thakur04@gmail.com',
      phone: '+91 75665 55014',
      role: UserRole.MR,
    },
    {
      empCode: 'EMP011',
      name: 'VIJAY D LUDHEKAR',
      hq: 'NAGPUR',
      email: 'vijayludhekar123@gmail.com',
      phone: '+91 77740 45782',
      role: UserRole.MR,
    },
    {
      empCode: 'EMP012',
      name: 'ZIYA W KHAN',
      hq: 'YAVATMAL',
      email: 'kziya4600@gmail.com',
      phone: '+91 99211 40750',
      role: UserRole.MR,
    },
    {
      empCode: 'EMP013',
      name: 'YASHVANT NAMDEORAO BHUIBHAR',
      hq: 'AKOLA',
      email: 'ynbhuibhar@gmail.com',
      phone: '+91 90112 26680',
      role: UserRole.MR,
    },
    {
      empCode: 'EMP014',
      name: 'JAYA D WANDHARE',
      hq: 'WARDHA',
      email: 'jayabhandakkar@gmail.com',
      phone: '+91 98236 63800',
      role: UserRole.MR,
    },
  ];

  const userMap: { [email: string]: any } = {};

  for (const emp of employeeData) {
    const parts = emp.name.trim().split(' ');
    const firstName = parts[0] ? parts[0].charAt(0) + parts[0].slice(1).toLowerCase() : 'User';
    const lastName = parts.slice(1).join(' ')
      ? parts.slice(1).map(p => p.charAt(0) + p.slice(1).toLowerCase()).join(' ')
      : 'Biocros';

    const hqTerritory = territoryMap[emp.hq] || territoryMap['INDORE'];

    const u = await prisma.user.create({
      data: {
        employeeId: emp.empCode,
        email: emp.email.trim().toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        phone: emp.phone,
        role: emp.role,
        designation: emp.role === UserRole.SUPER_ADMIN ? 'Managing Director' : emp.role,
        department: 'Sales & Commercial',
        hqId: hqTerritory.id,
        isActive: true,
      },
    });

    // Assign Primary Territory
    await prisma.userTerritory.create({
      data: {
        userId: u.id,
        territoryId: hqTerritory.id,
        isPrimary: true,
      },
    });

    userMap[emp.email.trim().toLowerCase()] = u;
  }

  // Also create demo admin alias if not present
  if (!userMap['admin@pharmax.com']) {
    const adminUser = await prisma.user.create({
      data: {
        employeeId: 'EMP999',
        email: 'admin@pharmax.com',
        passwordHash,
        firstName: 'System',
        lastName: 'Admin',
        phone: '+91 98765 43210',
        role: UserRole.SUPER_ADMIN,
        designation: 'Administrator',
        department: 'IT',
        hqId: territoryMap['INDORE'].id,
        isActive: true,
      },
    });
    await prisma.userTerritory.create({
      data: {
        userId: adminUser.id,
        territoryId: territoryMap['INDORE'].id,
        isPrimary: true,
      },
    });
  }

  // Establish reporting hierarchy:
  // Nishant (SUPER_ADMIN) -> Azhar (RSM) -> Ashish/Hitesh (ASM) -> MRs
  const nishant = userMap['info@biocrospharma.in'];
  const azhar = userMap['azharshamim68@gmail.com'];
  const ashish = userMap['biocrosashish@gmail.com'];
  const hitesh = userMap['hitesh2026@gmail.com'];

  if (azhar && nishant) {
    await prisma.user.update({ where: { id: azhar.id }, data: { managerId: nishant.id } });
  }
  if (ashish && azhar) {
    await prisma.user.update({ where: { id: ashish.id }, data: { managerId: azhar.id } });
  }
  if (hitesh && azhar) {
    await prisma.user.update({ where: { id: hitesh.id }, data: { managerId: azhar.id } });
  }

  // Map MP MRs to Ashish, Maharashtra MRs to Hitesh
  const mpEmails = ['daporkardheeraj@gmail.com', 'sourabhuplawdiya@gmail.com', 'shayammba.dangi@gmail.com', 'mohdsameer0724@gmail.com', 'subhampatil255726@gmail.com', 'jitu.thakur04@gmail.com'];
  const mhEmails = ['vijayludhekar123@gmail.com', 'kziya4600@gmail.com', 'ynbhuibhar@gmail.com', 'jayabhandakkar@gmail.com'];

  for (const email of mpEmails) {
    if (userMap[email] && ashish) {
      await prisma.user.update({ where: { id: userMap[email].id }, data: { managerId: ashish.id } });
    }
  }
  for (const email of mhEmails) {
    if (userMap[email] && hitesh) {
      await prisma.user.update({ where: { id: userMap[email].id }, data: { managerId: hitesh.id } });
    }
  }
  console.log('✅ All 14 Biocros Employees seeded with reporting lines.');

  // ── 4. SEED BIOCROS PRODUCTS & SCHEMES ─────────────────────────────────────
  console.log('📦 Seeding Biocros Products & Schemes...');

  // Trade Scheme
  const tradeScheme = await prisma.tradeScheme.create({
    data: {
      name: '10+1 Promotional Scheme',
      description: 'Buy 10 units and get 1 unit free (10+1)',
      discountType: 'FREE_ITEM',
      minQuantity: 10,
      discountValue: 1,
      isActive: true,
    },
  });

  const biocrosProducts = [
    { name: 'HEMOVAC SYRUP', packing: '300ML', category: 'Syrup', units: 1, mrp: 180, ptr: 144, pts: 126, code: 'BC-HEM-SYR' },
    { name: 'HEMOVAC TABLET', packing: '30', category: 'Tablet', units: 30, mrp: 240, ptr: 192, pts: 168, code: 'BC-HEM-TAB' },
    { name: 'BIOSPORE SACHET', packing: '50', category: 'Sachet', units: 50, mrp: 500, ptr: 400, pts: 350, code: 'BC-BIO-SAC50' },
    { name: 'BIOSPORE TABLET', packing: '10', category: 'Tablet', units: 10, mrp: 150, ptr: 120, pts: 105, code: 'BC-BIO-TAB10' },
    { name: 'BIOSPORE 4 SACHET', packing: '50', category: 'Sachet', units: 50, mrp: 600, ptr: 480, pts: 420, code: 'BC-BIO4-SAC50' },
    { name: 'BIOSPORE 4 TABLET', packing: '10', category: 'Tablet', units: 10, mrp: 200, ptr: 160, pts: 140, code: 'BC-BIO4-TAB10' },
    { name: 'PNCROS DRS CAPSULE', packing: '10', category: 'Capsule', units: 10, mrp: 220, ptr: 176, pts: 154, code: 'BC-PNC-DRS' },
    { name: 'PNCROS 40', packing: '10', category: 'Tablet', units: 10, mrp: 140, ptr: 112, pts: 98, code: 'BC-PNC-40' },
    { name: 'RINOVAC SUSPENSION', packing: '200ML', category: 'Suspension', units: 1, mrp: 160, ptr: 128, pts: 112, code: 'BC-RIN-SUS' },
    { name: 'RINOVAC TABLET', packing: '10', category: 'Tablet', units: 10, mrp: 120, ptr: 96, pts: 84, code: 'BC-RIN-TAB' },
    { name: 'RINOVAC DROP', packing: '15ML', category: 'Drop', units: 1, mrp: 85, ptr: 68, pts: 60, code: 'BC-RIN-DRP' },
    { name: 'ALKATAGE 200 ml', packing: '200ML', category: 'Syrup', units: 1, mrp: 175, ptr: 140, pts: 122, code: 'BC-ALK-200' },
    { name: 'CALCICAL TABLET', packing: '10', category: 'Tablet', units: 10, mrp: 130, ptr: 104, pts: 91, code: 'BC-CAL-TAB' },
    { name: 'BENZYLAC TABLET', packing: '10', category: 'Tablet', units: 10, mrp: 190, ptr: 152, pts: 133, code: 'BC-BEN-TAB' },
    { name: 'BENZYLAC SYRUP', packing: '200ML', category: 'Syrup', units: 1, mrp: 165, ptr: 132, pts: 115, code: 'BC-BEN-SYR' },
    { name: 'VEEPROS D3 CAPSULE', packing: '4', category: 'Capsule', units: 4, mrp: 140, ptr: 112, pts: 98, code: 'BC-VEE-D3CAP' },
    { name: 'VEEPROS D3 NANOSHOTS', packing: '4', category: 'Suspension', units: 4, mrp: 260, ptr: 208, pts: 182, code: 'BC-VEE-NANO' },
    { name: 'VEEPROS SACHET', packing: '20', category: 'Sachet', units: 20, mrp: 320, ptr: 256, pts: 224, code: 'BC-VEE-SAC' },
    { name: 'BRENZ POWDER', packing: '105GM', category: 'Powder', units: 1, mrp: 290, ptr: 232, pts: 203, code: 'BC-BRZ-PWD' },
    { name: 'MONTECROS L', packing: '10', category: 'Tablet', units: 10, mrp: 170, ptr: 136, pts: 119, code: 'BC-MON-L' },
    { name: 'BIOFIT PLUS M', packing: '10', category: 'Tablet', units: 10, mrp: 210, ptr: 168, pts: 147, code: 'BC-BIO-PLM' },
    { name: 'BIOFIT PLUS F', packing: '10', category: 'Tablet', units: 10, mrp: 210, ptr: 168, pts: 147, code: 'BC-BIO-PLF' },
    { name: 'ARGICROS BLUE SACHET', packing: '20', category: 'Sachet', units: 20, mrp: 450, ptr: 360, pts: 315, code: 'BC-ARG-BLU' },
    { name: 'ARGICROS PINK SACHET', packing: '20', category: 'Sachet', units: 20, mrp: 450, ptr: 360, pts: 315, code: 'BC-ARG-PNK' },
  ];

  const productImagesMap: Record<string, string> = {
    'ALKATAGE 200 ml': '/uploads/content/Alkatage-Generated.png',
    'BENZYLAC TABLET': '/uploads/content/Benzylac-generated.png',
    'BENZYLAC SYRUP': '/uploads/content/Benzylac-generated.png',
    'BIOFIT PLUS M': '/uploads/content/BioFitPlus-M-Generated.png',
    'BIOFIT PLUS F': '/uploads/content/BiofitPlus-F-Generated.png',
    'BIOSPORE 4 TABLET': '/uploads/content/Biospore4-Tab-Generated.png',
    'BIOSPORE 4 SACHET': '/uploads/content/Biospore4-generated.png',
    'BIOSPORE TABLET': '/uploads/content/Biospore4-Tab-Generated.png',
    'BIOSPORE SACHET': '/uploads/content/Biospore4-generated.png',
    'MONTECROS L': '/uploads/content/Montecros-Generated.png',
    'PNCROS 40': '/uploads/content/Pncors-40-Generated.png',
    'PNCROS DRS CAPSULE': '/uploads/content/Pncors-40-Generated.png',
    'RINOVAC SUSPENSION': '/uploads/content/RinovacPlus-Generated.png',
    'RINOVAC DROP': '/uploads/content/RinovacPlus-Generated.png',
    'RINOVAC TABLET': '/uploads/content/RinovacTab-Generated.png',
    'VEEPROS D3 CAPSULE': '/uploads/content/VeeprosD3-Landscape.png',
    'VEEPROS D3 NANOSHOTS': '/uploads/content/VeeprosD3-Landscape.png',
    'VEEPROS SACHET': '/uploads/content/VeeprosD3-Landscape.png',
  };

  let pIndex = 1;
  for (const p of biocrosProducts) {
    await prisma.product.create({
      data: {
        productCode: `PRD${String(pIndex).padStart(3, '0')}`,
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.packing.toString(),
        unitsInPackage: p.units,
        mrp: p.mrp,
        ptr: p.ptr,
        pts: p.pts,
        description: `Packing: ${p.packing} | Scheme: 10+1`,
        productImage: productImagesMap[p.name] || null,
        isActive: true,
      },
    });
    pIndex++;
  }
  console.log(`✅ ${biocrosProducts.length} Biocros Products created with 10+1 Schemes.`);

  // ── 4b. SEED DIGITAL DETAILING CONTENT (FWD PRODUCT IMAGES) ────────────────
  console.log('📱 Seeding Digital Detailing Content...');
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Biocros 2026 Core Detailing Campaign',
      description: 'Core product detailing materials for doctors and healthcare specialists.',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    },
  });

  const digitalDetailingContents = [
    {
      title: 'Alkatage 200 ml - Visual Aid',
      productName: 'ALKATAGE 200 ml',
      fileUrl: '/uploads/content/Alkatage-Generated.png',
      thumbnailUrl: '/uploads/content/Alkatage-Generated.png',
      description: 'Complete digital visual aid for Alkatage systemic alkalizer formulation.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Benzylac Tablet - Clinical Presentation',
      productName: 'BENZYLAC TABLET',
      fileUrl: '/uploads/content/Benzylac-generated.png',
      thumbnailUrl: '/uploads/content/Benzylac-generated.png',
      description: 'Digital detailing presentation detailing efficacy and indications.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Benzylac Advanced - Mode of Action',
      productName: 'BENZYLAC TABLET',
      fileUrl: '/uploads/content/BenzylacAdvanced-Generated.png',
      thumbnailUrl: '/uploads/content/BenzylacAdvanced-Generated.png',
      description: 'Advanced detailing slide covering pharmacology and doctor FAQ.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'BioFit Plus M - Men Vitality Detailing',
      productName: 'BIOFIT PLUS M',
      fileUrl: '/uploads/content/BioFitPlus-M-Generated.png',
      thumbnailUrl: '/uploads/content/BioFitPlus-M-Generated.png',
      description: 'Comprehensive micronutrient and antioxidant detailing sheet.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Biofit Plus F - Women Health Detailing',
      productName: 'BIOFIT PLUS F',
      fileUrl: '/uploads/content/BiofitPlus-F-Generated.png',
      thumbnailUrl: '/uploads/content/BiofitPlus-F-Generated.png',
      description: 'Essential vitamins & minerals formulation for female healthcare.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Biospore 4 Tablet - Gut Microbiome Slide',
      productName: 'BIOSPORE 4 TABLET',
      fileUrl: '/uploads/content/Biospore4-Tab-Generated.png',
      thumbnailUrl: '/uploads/content/Biospore4-Tab-Generated.png',
      description: 'Probiotic strain specification and clinical trials overview.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Biospore 4 Sachet - Pediatric & Adult Detailing',
      productName: 'BIOSPORE 4 SACHET',
      fileUrl: '/uploads/content/Biospore4-generated.png',
      thumbnailUrl: '/uploads/content/Biospore4-generated.png',
      description: 'Spores suspension visual presentation for gastroenterology practice.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Montecros L - Allergy & Respiratory Slide',
      productName: 'MONTECROS L',
      fileUrl: '/uploads/content/Montecros-Generated.png',
      thumbnailUrl: '/uploads/content/Montecros-Generated.png',
      description: 'Montelukast & Levocetirizine dual action respiratory presentation.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Pncros 40 - PPI Detailing Visual Aid',
      productName: 'PNCROS 40',
      fileUrl: '/uploads/content/Pncors-40-Generated.png',
      thumbnailUrl: '/uploads/content/Pncors-40-Generated.png',
      description: 'Fast acid suppression and GERD symptom relief detailing slide.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Rinovac Plus Suspension - Cough & Cold Aid',
      productName: 'RINOVAC SUSPENSION',
      fileUrl: '/uploads/content/RinovacPlus-Generated.png',
      thumbnailUrl: '/uploads/content/RinovacPlus-Generated.png',
      description: 'Multi-action cold and flu formulation for family practice.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Rinovac Tablet - Anti-Cold Clinical Slide',
      productName: 'RINOVAC TABLET',
      fileUrl: '/uploads/content/RinovacTab-Generated.png',
      thumbnailUrl: '/uploads/content/RinovacTab-Generated.png',
      description: 'Symptomatic cold and allergic rhinitis clinical presentation.',
      contentType: 'IMAGE' as const,
    },
    {
      title: 'Veepros D3 - Bone & Immunity Visual',
      productName: 'VEEPROS D3 CAPSULE',
      fileUrl: '/uploads/content/VeeprosD3-Landscape.png',
      thumbnailUrl: '/uploads/content/VeeprosD3-Landscape.png',
      description: 'Cholecalciferol 60,000 IU therapeutic detailing presentation.',
      contentType: 'IMAGE' as const,
    },
  ];

  for (const c of digitalDetailingContents) {
    await prisma.content.create({
      data: {
        title: c.title,
        productName: c.productName,
        fileUrl: c.fileUrl,
        thumbnailUrl: c.thumbnailUrl,
        description: c.description,
        contentType: c.contentType,
        campaignId: campaign.id,
        version: '1.0',
        isActive: true,
        isDisabled: false,
      },
    });
  }
  console.log(`✅ ${digitalDetailingContents.length} Digital Detailing Content slides created.`);

  // ── 5. SEED AREAS, HOSPITALS, DOCTORS, AND RETAILERS PER HQ ───────────────
  console.log('🏥 Seeding Customers & Areas for each HQ...');
  for (const hq of hqList) {
    const terr = territoryMap[hq.name.toUpperCase()];
    if (!terr) continue;

    // Create Main Area
    const area = await prisma.area.create({
      data: {
        name: `${hq.name} Central Area`,
        areaCode: `AREA-${hq.name.toUpperCase().slice(0, 4)}`,
        hqId: terr.id,
      },
    });

    // Create Distributor
    const dist = await prisma.distributor.create({
      data: {
        name: `${hq.name} Pharma Agencies`,
        ownerName: `Rajesh Sharma`,
        phone: '+91 98260 12345',
        address: `Main Road, ${hq.name}`,
        city: hq.name,
        state: hq.state,
        territoryId: terr.id,
        approvalStatus: 'APPROVED' as any,
      },
    });

    // Create Hospital
    const hosp = await prisma.hospital.create({
      data: {
        name: `${hq.name} Care Hospital & Research`,
        type: 'Private Multi-Speciality',
        beds: 150,
        address: `Civil Lines, ${hq.name}`,
        city: hq.name,
        state: hq.state,
        phone: '+91 731 2450000',
        territoryId: terr.id,
        hqId: terr.id,
        areaId: area.id,
        approvalStatus: 'APPROVED' as any,
      },
    });

    // Create Doctors
    await prisma.doctor.create({
      data: {
        firstName: 'Rajesh',
        lastName: 'Sharma',
        specialty: 'Physician',
        qualification: 'MBBS, MD',
        classification: DoctorClassification.A_PLUS,
        city: hq.name,
        state: hq.state,
        territoryId: terr.id,
        hqId: terr.id,
        areaId: area.id,
        hospitalId: hosp.id,
        approvalStatus: 'APPROVED' as any,
        isActive: true,
      },
    });

    await prisma.doctor.create({
      data: {
        firstName: 'Sunil',
        lastName: 'Verma',
        specialty: 'Gastroenterology',
        qualification: 'MBBS, DNB',
        classification: DoctorClassification.A,
        city: hq.name,
        state: hq.state,
        territoryId: terr.id,
        hqId: terr.id,
        areaId: area.id,
        approvalStatus: 'APPROVED' as any,
        isActive: true,
      },
    });

    // Create Retailers
    await prisma.retailer.create({
      data: {
        name: `${hq.name} Medicos`,
        ownerName: 'Sunil Jain',
        phone: '+91 98270 54321',
        address: `Station Road, ${hq.name}`,
        city: hq.name,
        state: hq.state,
        territoryId: terr.id,
        hqId: terr.id,
        areaId: area.id,
        distributorId: dist.id,
        approvalStatus: 'APPROVED' as any,
      },
    });
  }

  console.log('✅ Customers and Areas populated across all Headquarters.');
  console.log('\n🎉 Biocros Migration & Seeding completed successfully!');
  console.log('📋 Login Credentials for all accounts:');
  console.log('   Password: password123');
  console.log('   Super Admin: info@biocrospharma.in');
  console.log('   RSM        : azharshamim68@gmail.com');
  console.log('   ASM 1      : biocrosashish@gmail.com');
  console.log('   ASM 2      : hitesh2026@gmail.com');
  console.log('   MRs (10)   : daporkardheeraj@gmail.com, sourabhuplawdiya@gmail.com, etc.');
}

if (require.main === module) {
  runBiocrosSeed()
    .catch(e => {
      console.error('❌ Migration failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
