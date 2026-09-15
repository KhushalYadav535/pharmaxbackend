require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const productSpecialtyMap = {
  // Gynecology Core & Related
  'ARGICROS PINK SACHET': 'Gynecology',
  'ARGICROS BLUE SACHET': 'Gynecology',
  'BIOFIT PLUS F': 'Gynecology, General Medicine',
  'HEMOVAC SYRUP': 'Gynecology, General Medicine',
  'HEMOVAC TABLET': 'Gynecology, General Medicine',
  'CALCICAL TABLET': 'Gynecology, Orthopedics, General Medicine',
  'VEEPROS D3 CAPSULE': 'Gynecology, Orthopedics, General Medicine',
  'VEEPROS SACHET': 'Gynecology, Orthopedics, General Medicine',
  'VEEPROS D3 NANOSHOTS': 'Gynecology, Orthopedics, Pediatrics',
  'ALKATAGE 200 ml': 'Gynecology, General Medicine, Urology',

  // General Medicine & Anti-infectives
  'PNCROS 40': 'General Medicine, Gastroenterology',
  'PNCROS DRS CAPSULE': 'General Medicine, Gastroenterology, Gynecology',
  'BENZYLAC TABLET': 'General Medicine, ENT',
  'BENZYLAC SYRUP': 'Pediatrics, General Medicine, ENT',
  'BIOFIT PLUS M': 'General Medicine',
  'BRENZ POWDER': 'General Medicine, Pediatrics',
  'MONTECROS L': 'ENT, General Medicine, Pediatrics',

  // Probiotics
  'BIOSPORE SACHET': 'Pediatrics, General Medicine, Gastroenterology, Gynecology',
  'BIOSPORE TABLET': 'General Medicine, Gastroenterology',
  'BIOSPORE 4 SACHET': 'Pediatrics, General Medicine, Gastroenterology',
  'BIOSPORE 4 TABLET': 'General Medicine, Gastroenterology',

  // Pediatric & ENT drops/syrups
  'RINOVAC DROP': 'Pediatrics, ENT',
  'RINOVAC SUSPENSION': 'Pediatrics, ENT, General Medicine',
  'RINOVAC TABLET': 'ENT, General Medicine',
};

async function main() {
  console.log('🔄 Updating Product Specialties in Database...');
  let updatedCount = 0;

  for (const [name, speciality] of Object.entries(productSpecialtyMap)) {
    const res = await prisma.product.updateMany({
      where: { name: { equals: name, mode: 'insensitive' } },
      data: { speciality },
    });
    if (res.count > 0) {
      console.log(`✅ Set speciality for ${name}: "${speciality}"`);
      updatedCount += res.count;
    }
  }

  console.log(`\n🎉 Completed updating ${updatedCount} products with their medical specialties.`);
}

main()
  .catch(err => {
    console.error('❌ Error updating product specialties:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
