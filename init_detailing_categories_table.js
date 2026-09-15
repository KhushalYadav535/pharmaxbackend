require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { v4: uuidv4 } = require('uuid');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const defaultCategories = [
  {
    name: 'Gynecology & Obstetrics',
    code: 'GYNECOLOGY',
    description: 'Maternal health, reproductive support, prenatal care, and gynecological formulations.',
    productNames: [
      'ARGICROS PINK SACHET',
      'ARGICROS BLUE SACHET',
      'BIOFIT PLUS F',
      'HEMOVAC SYRUP',
      'HEMOVAC TABLET',
      'CALCICAL TABLET',
      'VEEPROS D3 CAPSULE',
      'VEEPROS SACHET',
      'VEEPROS D3 NANOSHOTS',
      'ALKATAGE 200 ml',
      'PNCROS DRS CAPSULE',
      'BIOSPORE SACHET'
    ],
    doctorKeywords: ['gyno', 'gynecology', 'gynaecology', 'obstetrics', 'obg', 'ob-gyn', 'consultant gynecologist', 'women health'],
    color: '#EC4899',
  },
  {
    name: 'General Medicine',
    code: 'GENERAL_MEDICINE',
    description: 'Internal medicine, adult general healthcare, anti-infectives, and chronic therapeutics.',
    productNames: [
      'PNCROS 40',
      'PNCROS DRS CAPSULE',
      'BENZYLAC TABLET',
      'BENZYLAC SYRUP',
      'BIOFIT PLUS M',
      'BIOFIT PLUS F',
      'BIOSPORE TABLET',
      'BIOSPORE SACHET',
      'BIOSPORE 4 TABLET',
      'BIOSPORE 4 SACHET',
      'BRENZ POWDER',
      'CALCICAL TABLET',
      'HEMOVAC SYRUP',
      'HEMOVAC TABLET',
      'MONTECROS L',
      'RINOVAC TABLET',
      'RINOVAC SUSPENSION',
      'VEEPROS D3 CAPSULE',
      'VEEPROS D3 NANOSHOTS',
      'ALKATAGE 200 ml'
    ],
    doctorKeywords: ['general medicine', 'internal medicine', 'general physician', 'consultant physician', 'consultant specialist', 'general practitioner', 'physician', 'family medicine'],
    color: '#2563EB',
  },
  {
    name: 'Pediatrics',
    code: 'PEDIATRICS',
    description: 'Child health, pediatric antibiotics, drops, respiratory, and pediatric suspensions.',
    productNames: [
      'RINOVAC DROP',
      'RINOVAC SUSPENSION',
      'BENZYLAC SYRUP',
      'BIOSPORE SACHET',
      'BIOSPORE 4 SACHET',
      'BRENZ POWDER',
      'MONTECROS L',
      'VEEPROS D3 NANOSHOTS',
      'HEMOVAC SYRUP'
    ],
    doctorKeywords: ['pediatrics', 'pediatrician', 'paediatrics', 'paediatrician', 'child specialist', 'child'],
    color: '#F59E0B',
  },
  {
    name: 'Gastroenterology',
    code: 'GASTROENTEROLOGY',
    description: 'Digestive tract health, probiotics, acid reflux, and enteric stabilization.',
    productNames: [
      'BIOSPORE SACHET',
      'BIOSPORE TABLET',
      'BIOSPORE 4 SACHET',
      'BIOSPORE 4 TABLET',
      'PNCROS 40',
      'PNCROS DRS CAPSULE',
      'ALKATAGE 200 ml',
      'BRENZ POWDER'
    ],
    doctorKeywords: ['gastroenterology', 'gastro', 'gastroenterologist', 'hepatology'],
    color: '#9333EA',
  },
  {
    name: 'ENT & Respiratory',
    code: 'ENT',
    description: 'Ear, nose, throat, anti-allergic, and respiratory therapies.',
    productNames: [
      'MONTECROS L',
      'RINOVAC TABLET',
      'RINOVAC SUSPENSION',
      'RINOVAC DROP',
      'BENZYLAC TABLET',
      'BENZYLAC SYRUP'
    ],
    doctorKeywords: ['ent', 'ent specialist', 'otolaryngology', 'otorhinolaryngology', 'pulmonology', 'chest physician'],
    color: '#059669',
  },
  {
    name: 'Orthopedics',
    code: 'ORTHOPEDICS',
    description: 'Bone density, calcium metabolism, joint health, and high-dose vitamin D3.',
    productNames: [
      'CALCICAL TABLET',
      'VEEPROS D3 CAPSULE',
      'VEEPROS SACHET',
      'VEEPROS D3 NANOSHOTS',
      'BENZYLAC TABLET'
    ],
    doctorKeywords: ['orthopedics', 'orthopaedics', 'orthopedic surgeon', 'ortho', 'bone', 'joint', 'general surgery', 'consultant surgeon'],
    color: '#EA580C',
  },
  {
    name: 'Cardiology',
    code: 'CARDIOLOGY',
    description: 'Cardiovascular therapeutics, arterial wellness, and metabolic support.',
    productNames: [
      'ARGICROS PINK SACHET',
      'BIOFIT PLUS M',
      'VEEPROS D3 CAPSULE'
    ],
    doctorKeywords: ['cardiology', 'cardiologist', 'heart', 'cardiac'],
    color: '#E11D48',
  },
  {
    name: 'Dermatology',
    code: 'DERMATOLOGY',
    description: 'Skin health, anti-fungal, micro-nutritional, and restorative formulations.',
    productNames: [
      'BENZYLAC TABLET',
      'BIOFIT PLUS F',
      'VEEPROS D3 CAPSULE',
      'BIOSPORE TABLET'
    ],
    doctorKeywords: ['dermatology', 'dermatologist', 'skin', 'cosmetologist'],
    color: '#D97706',
  }
];

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS detailing_categories (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      code VARCHAR(50) NOT NULL,
      description TEXT,
      "productNames" TEXT[] DEFAULT '{}',
      "doctorKeywords" TEXT[] DEFAULT '{}',
      color VARCHAR(30) DEFAULT '#059669',
      "isActive" BOOLEAN DEFAULT TRUE,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ Table verified.');

  for (const cat of defaultCategories) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM detailing_categories WHERE LOWER(name) = LOWER($1) OR code = $2`,
      cat.name,
      cat.code
    );

    if (existing.length === 0) {
      const id = uuidv4();
      await prisma.$executeRawUnsafe(
        `INSERT INTO detailing_categories (id, name, code, description, "productNames", "doctorKeywords", color, "isActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        id,
        cat.name,
        cat.code,
        cat.description,
        cat.productNames,
        cat.doctorKeywords,
        cat.color
      );
      console.log(`➕ Created detailing category: ${cat.name} (${cat.productNames.length} products mapped)`);
    } else {
      // Update mapped products
      await prisma.$executeRawUnsafe(
        `UPDATE detailing_categories 
         SET "productNames" = $1, "doctorKeywords" = $2, color = $3, "updatedAt" = NOW()
         WHERE id = $4`,
        cat.productNames,
        cat.doctorKeywords,
        cat.color,
        existing[0].id
      );
      console.log(`🔄 Updated detailing category: ${cat.name} (${cat.productNames.length} products mapped)`);
    }
  }

  console.log('\n🎉 Detailing categories seeded successfully.');
}

main()
  .catch(err => {
    console.error('❌ Error seeding categories:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
