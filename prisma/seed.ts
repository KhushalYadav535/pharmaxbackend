import { PrismaClient, UserRole, DoctorClassification } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });


async function main() {
  console.log('🌱 Starting database seed...');

  // ─── Territories ──────────────────────────────────────────────────────────
  const territory = await prisma.territory.upsert({
    where: { code: 'MUM-WEST' },
    update: {},
    create: {
      name: 'Mumbai West',
      code: 'MUM-WEST',
      state: 'Maharashtra',
      region: 'West',
      zone: 'West Zone',
    },
  });

  const territory2 = await prisma.territory.upsert({
    where: { code: 'MUM-EAST' },
    update: {},
    create: {
      name: 'Mumbai East',
      code: 'MUM-EAST',
      state: 'Maharashtra',
      region: 'West',
      zone: 'West Zone',
    },
  });

  console.log('✅ Territories created');

  // ─── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('pharmax123', 12);

  const users = [
    { email: 'admin@pharmax.com', firstName: 'Super', lastName: 'Admin', role: UserRole.SUPER_ADMIN, employeeId: 'EMP001' },
    { email: 'nsm@pharmax.com', firstName: 'Rajesh', lastName: 'Sharma', role: UserRole.NSM, employeeId: 'EMP002' },
    { email: 'rsm@pharmax.com', firstName: 'Priya', lastName: 'Patel', role: UserRole.RSM, employeeId: 'EMP003' },
    { email: 'asm@pharmax.com', firstName: 'Amit', lastName: 'Singh', role: UserRole.ASM, employeeId: 'EMP004' },
    { email: 'mr@pharmax.com', firstName: 'Rahul', lastName: 'Verma', role: UserRole.MR, employeeId: 'EMP005' },
    { email: 'mr2@pharmax.com', firstName: 'Sunita', lastName: 'Kumar', role: UserRole.MR, employeeId: 'EMP006' },
    { email: 'trade@pharmax.com', firstName: 'Vikram', lastName: 'Mehta', role: UserRole.TRADE_REP, employeeId: 'EMP007' },
    { email: 'pm@pharmax.com', firstName: 'Ananya', lastName: 'Gupta', role: UserRole.PRODUCT_MANAGER, employeeId: 'EMP008' },
  ];

  const createdUsers: any[] = [];
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, phone: '+91 98765 43210', designation: u.role, isActive: true },
    });
    createdUsers.push(user);
  }

  // Set manager relationships
  const [, nsm, rsm, asm, mr1, mr2] = createdUsers;
  await prisma.user.update({ where: { id: rsm.id }, data: { managerId: nsm.id } });
  await prisma.user.update({ where: { id: asm.id }, data: { managerId: rsm.id } });
  await prisma.user.update({ where: { id: mr1.id }, data: { managerId: asm.id } });
  await prisma.user.update({ where: { id: mr2.id }, data: { managerId: asm.id } });

  // Assign territories
  await prisma.userTerritory.upsert({
    where: { userId_territoryId: { userId: mr1.id, territoryId: territory.id } },
    update: {},
    create: { userId: mr1.id, territoryId: territory.id, isPrimary: true },
  });
  await prisma.userTerritory.upsert({
    where: { userId_territoryId: { userId: mr2.id, territoryId: territory2.id } },
    update: {},
    create: { userId: mr2.id, territoryId: territory2.id, isPrimary: true },
  });

  console.log('✅ Users created');

  // ─── Hospitals ────────────────────────────────────────────────────────────
  const hospital1 = await prisma.hospital.upsert({
    where: { id: 'hospital-001' },
    update: {},
    create: {
      id: 'hospital-001',
      name: 'Lilavati Hospital & Research Centre',
      type: 'private',
      beds: 330,
      departments: ['Cardiology', 'Oncology', 'Neurology', 'Orthopedics', 'Nephrology'],
      address: 'A-791, Bandra Reclamation',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      phone: '022-2675 1000',
      territoryId: territory.id,
    },
  });

  const hospital2 = await prisma.hospital.upsert({
    where: { id: 'hospital-002' },
    update: {},
    create: {
      id: 'hospital-002',
      name: 'Kokilaben Dhirubhai Ambani Hospital',
      type: 'private',
      beds: 750,
      departments: ['Cardiac Sciences', 'Cancer Care', 'Neurosciences', 'Orthopedics'],
      address: 'Rao Saheb Achutrao Patwardhan Marg, Four Bungalows',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400053',
      phone: '022-4269 6969',
      territoryId: territory.id,
    },
  });

  console.log('✅ Hospitals created');

  // ─── Doctors ─────────────────────────────────────────────────────────────
  const doctors = [
    { id: 'doc-001', firstName: 'Suresh', lastName: 'Mehta', specialty: 'Cardiology', classification: DoctorClassification.A_PLUS, prescriptionPotential: 9, hospitalId: hospital1.id },
    { id: 'doc-002', firstName: 'Kavita', lastName: 'Sharma', specialty: 'Endocrinology', classification: DoctorClassification.A, prescriptionPotential: 8, hospitalId: hospital1.id },
    { id: 'doc-003', firstName: 'Arun', lastName: 'Patel', specialty: 'General Medicine', classification: DoctorClassification.B, prescriptionPotential: 6 },
    { id: 'doc-004', firstName: 'Meena', lastName: 'Joshi', specialty: 'Pediatrics', classification: DoctorClassification.A, prescriptionPotential: 7 },
    { id: 'doc-005', firstName: 'Rohit', lastName: 'Nair', specialty: 'Neurology', classification: DoctorClassification.A_PLUS, prescriptionPotential: 9, hospitalId: hospital2.id },
    { id: 'doc-006', firstName: 'Deepa', lastName: 'Rao', specialty: 'Gynecology', classification: DoctorClassification.B, prescriptionPotential: 5 },
    { id: 'doc-007', firstName: 'Vijay', lastName: 'Kumar', specialty: 'Orthopedics', classification: DoctorClassification.A, prescriptionPotential: 8, hospitalId: hospital2.id },
    { id: 'doc-008', firstName: 'Anjali', lastName: 'Singh', specialty: 'Dermatology', classification: DoctorClassification.C, prescriptionPotential: 3 },
  ];

  for (const doc of doctors) {
    await prisma.doctor.upsert({
      where: { id: doc.id },
      update: {},
      create: { ...doc, city: 'Mumbai', state: 'Maharashtra', territoryId: territory.id, visitFrequency: 2, isActive: true },
    });
  }

  console.log('✅ Doctors created');

  // ─── Distributors & Retailers ──────────────────────────────────────────────
  const distributor = await prisma.distributor.upsert({
    where: { id: 'dist-001' },
    update: {},
    create: {
      id: 'dist-001',
      name: 'Shree Pharma Distributors',
      ownerName: 'Mahesh Gupta',
      phone: '+91 98765 11111',
      address: 'Shop No 15, Medical Market',
      city: 'Mumbai',
      state: 'Maharashtra',
      creditLimit: 500000,
      creditDays: 30,
      territoryId: territory.id,
    },
  });

  const retailers = [
    { id: 'ret-001', name: 'Life Care Pharmacy', ownerName: 'Ramesh Shah', phone: '+91 98765 22222', address: '12, Linking Road', city: 'Mumbai', category: 'A' },
    { id: 'ret-002', name: 'Medplus Pharmacy', ownerName: 'Seema Jain', phone: '+91 98765 33333', address: '45, Hill Road', city: 'Mumbai', category: 'B' },
    { id: 'ret-003', name: 'Apollo Pharmacy', ownerName: 'Kiran Patil', phone: '+91 98765 44444', address: '78, Turner Road', city: 'Mumbai', category: 'A' },
    { id: 'ret-004', name: 'Jan Aushadhi Kendra', ownerName: 'Ravi Kumar', phone: '+91 98765 55555', address: '23, Market Area', city: 'Mumbai', category: 'C' },
  ];

  for (const ret of retailers) {
    await prisma.retailer.upsert({
      where: { id: ret.id },
      update: {},
      create: { ...ret, state: 'Maharashtra', distributorId: distributor.id, territoryId: territory.id, potentialScore: Math.floor(Math.random() * 5) + 5, visitFrequency: 2 },
    });
  }

  console.log('✅ Distributors and Retailers created');

  // ─── Sample Products ──────────────────────────────────────────────────────
  const sampleProducts = [
    { code: 'CARDIO-01', name: 'Cardiomax 10mg', openingBalance: 200, currentBalance: 150 },
    { code: 'DIAB-01', name: 'Glucocare 500mg', openingBalance: 300, currentBalance: 220 },
    { code: 'NEURO-01', name: 'Neurofit 25mg', openingBalance: 150, currentBalance: 90 },
  ];

  for (const sp of sampleProducts) {
    await prisma.sampleProduct.upsert({
      where: { code: sp.code },
      update: {},
      create: { ...sp, batchNumber: 'B2024001', expiryDate: new Date('2026-12-31') },
    });
  }

  // ─── Products ─────────────────────────────────────────────────────────────
  const products = [
    { code: 'CARD-TAB-10', name: 'Cardiomax 10mg Tablet', mrp: 450, ptr: 360, pts: 320, category: 'Cardiology' },
    { code: 'GLUC-TAB-500', name: 'Glucocare 500mg Tablet', mrp: 280, ptr: 224, pts: 200, category: 'Diabetes' },
    { code: 'NEUR-CAP-25', name: 'Neurofit 25mg Capsule', mrp: 620, ptr: 496, pts: 440, category: 'Neurology' },
    { code: 'AMOX-CAP-500', name: 'Amoxicare 500mg Capsule', mrp: 185, ptr: 148, pts: 130, category: 'Antibiotics' },
    { code: 'OMEP-CAP-20', name: 'Gastocare 20mg Capsule', mrp: 140, ptr: 112, pts: 98, category: 'Gastro' },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, isActive: true },
    });
  }

  console.log('✅ Sample products and Products created');

  // ─── Demo Visits ──────────────────────────────────────────────────────────
  const today = new Date();
  const doc1 = await prisma.doctor.findUnique({ where: { id: 'doc-001' } });

  if (doc1) {
    await prisma.visit.create({
      data: {
        visitType: 'DOCTOR',
        status: 'COMPLETED',
        userId: mr1.id,
        plannedDate: today,
        checkInTime: new Date(today.getTime() - 60 * 60000),
        checkOutTime: new Date(today.getTime() - 30 * 60000),
        durationMinutes: 30,
        checkInLat: 19.0596,
        checkInLng: 72.8295,
        checkInAddress: 'Lilavati Hospital, Bandra, Mumbai',
        doctorId: doc1.id,
        productsDiscussed: ['Cardiomax 10mg', 'Neurofit 25mg'],
        notes: 'Doctor showed interest in Cardiomax. Discussed clinical trials.',
        nextFollowUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        approvalStatus: 'APPROVED',
      },
    });
  }

  console.log('✅ Demo visits created');

  // ─── Training Modules ─────────────────────────────────────────────────────
  await prisma.trainingModule.upsert({
    where: { id: 'train-001' },
    update: {},
    create: {
      id: 'train-001',
      title: 'Cardiomax Product Knowledge',
      description: 'Complete guide to Cardiomax MOA, clinical studies, and detailing',
      contentType: 'PDF',
      duration: 45,
      isActive: true,
    },
  });

  console.log('✅ Training modules created');
  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Demo accounts (password: pharmax123):');
  console.log('  Super Admin : admin@pharmax.com');
  console.log('  NSM         : nsm@pharmax.com');
  console.log('  RSM         : rsm@pharmax.com');
  console.log('  ASM         : asm@pharmax.com');
  console.log('  MR          : mr@pharmax.com');
  console.log('  MR 2        : mr2@pharmax.com');
  console.log('  Trade Rep   : trade@pharmax.com');
  console.log('  Product Mgr : pm@pharmax.com');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
