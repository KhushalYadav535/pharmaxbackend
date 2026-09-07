require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const digitalDetailingContents = [
  {
    title: 'Alkatage 200 ml - Systemic Alkalizer Detailing',
    productName: 'ALKATAGE 200 ml',
    fileUrl: '/uploads/content/Alkatage-Generated.png',
    thumbnailUrl: '/uploads/content/Alkatage-Generated.png',
    description: 'Complete digital visual aid for Alkatage systemic alkalizer formulation.',
    contentType: 'IMAGE',
  },
  {
    title: 'Argicros Sachet - L-Arginine Reproductive Support',
    productName: 'ARGICROS PINK SACHET',
    fileUrl: '/uploads/content/Argicros-Pink-Generated.png',
    thumbnailUrl: '/uploads/content/Argicros-Pink-Generated.png',
    description: 'L-Arginine with Proanthocyanidins & Zinc for feto-placental circulation.',
    contentType: 'IMAGE',
  },
  {
    title: 'Benzylac Tablet - Anti-Infective Clinical Aid',
    productName: 'BENZYLAC TABLET',
    fileUrl: '/uploads/content/Benzylac-generated.png',
    thumbnailUrl: '/uploads/content/Benzylac-generated.png',
    description: 'Digital detailing presentation detailing efficacy, spectrum and indications.',
    contentType: 'IMAGE',
  },
  {
    title: 'Benzylac Advanced - Mode of Action & Syrup Formulation',
    productName: 'BENZYLAC SYRUP',
    fileUrl: '/uploads/content/BenzylacAdvanced-Generated.png',
    thumbnailUrl: '/uploads/content/BenzylacAdvanced-Generated.png',
    description: 'Advanced pediatric anti-infective visual slide covering pharmacology.',
    contentType: 'IMAGE',
  },
  {
    title: 'BioFit Plus M - Men Daily Vitality Detailing',
    productName: 'BIOFIT PLUS M',
    fileUrl: '/uploads/content/BioFitPlus-M-Generated.png',
    thumbnailUrl: '/uploads/content/BioFitPlus-M-Generated.png',
    description: 'Comprehensive micronutrient, ginseng, and antioxidant detailing sheet.',
    contentType: 'IMAGE',
  },
  {
    title: 'Biofit Plus F - Women Health & Vitality Detailing',
    productName: 'BIOFIT PLUS F',
    fileUrl: '/uploads/content/BiofitPlus-F-Generated.png',
    thumbnailUrl: '/uploads/content/BiofitPlus-F-Generated.png',
    description: 'Essential vitamins, minerals, iron, and folic acid for female wellness.',
    contentType: 'IMAGE',
  },
  {
    title: 'Biospore Sachet - Probiotic Spores Presentation',
    productName: 'BIOSPORE SACHET',
    fileUrl: '/uploads/content/Biospore-Sachets-Generated.png',
    thumbnailUrl: '/uploads/content/Biospore-Sachets-Generated.png',
    description: 'Bacillus clausii viable spores suspension for diarrhea management.',
    contentType: 'IMAGE',
  },
  {
    title: 'Biospore Tablet - Gut Flora Restorative Aid',
    productName: 'BIOSPORE TABLET',
    fileUrl: '/uploads/content/Biospore-Tablets-Generated.png',
    thumbnailUrl: '/uploads/content/Biospore-Tablets-Generated.png',
    description: 'Clinical evidence on gut microbiome stabilization and antibiotic resistance.',
    contentType: 'IMAGE',
  },
  {
    title: 'Biospore 4 Tablet - High-Potency 4 Billion Spores',
    productName: 'BIOSPORE 4 TABLET',
    fileUrl: '/uploads/content/Biospore4-Tab-Generated.png',
    thumbnailUrl: '/uploads/content/Biospore4-Tab-Generated.png',
    description: 'High-potency multi-strain probiotic for acute enteric infections.',
    contentType: 'IMAGE',
  },
  {
    title: 'Biospore 4 Sachet - Pediatric & Adult Detailing',
    productName: 'BIOSPORE 4 SACHET',
    fileUrl: '/uploads/content/Biospore4-generated.png',
    thumbnailUrl: '/uploads/content/Biospore4-generated.png',
    description: 'Spores suspension visual presentation for gastroenterology practice.',
    contentType: 'IMAGE',
  },
  {
    title: 'Brenz Powder - Instant Energy & Electrolyte Visual',
    productName: 'BRENZ POWDER',
    fileUrl: '/uploads/content/Brenz-generated.png',
    thumbnailUrl: '/uploads/content/Brenz-generated.png',
    description: 'Instant rehydration, dextrose, zinc, and vitamin C replenishment formula.',
    contentType: 'IMAGE',
  },
  {
    title: 'Calcical Tablet - Calcium & Bone Health Visual Aid',
    productName: 'CALCICAL TABLET',
    fileUrl: '/uploads/content/Calcicall-Tablets-Generated.png',
    thumbnailUrl: '/uploads/content/Calcicall-Tablets-Generated.png',
    description: 'Calcium citrate malate, calcitriol, and zinc for peak bone mass.',
    contentType: 'IMAGE',
  },
  {
    title: 'Hemovac Syrup - Complete Hematinic Presentation',
    productName: 'HEMOVAC SYRUP',
    fileUrl: '/uploads/content/Haemovac-Syrup-Generated.png',
    thumbnailUrl: '/uploads/content/Haemovac-Syrup-Generated.png',
    description: 'Ferrous ascorbate, folic acid & methylcobalamin for rapid hemoglobin rise.',
    contentType: 'IMAGE',
  },
  {
    title: 'Montecros L - Allergy & Rhinitis Overview',
    productName: 'MONTECROS L',
    fileUrl: '/uploads/content/Montecros-Generated.png',
    thumbnailUrl: '/uploads/content/Montecros-Generated.png',
    description: 'Montelukast + Levocetirizine dual mechanism for 24-hr relief.',
    contentType: 'IMAGE',
  },
  {
    title: 'Montecros L - Asthma & Bronchospasm Clinical Slide',
    productName: 'MONTECROS L',
    fileUrl: '/uploads/content/Montecros-L-Generated.png',
    thumbnailUrl: '/uploads/content/Montecros-L-Generated.png',
    description: 'In-depth clinical trial data on nocturnal asthma control and quality of life.',
    contentType: 'IMAGE',
  },
  {
    title: 'Pncros 40 - Fast Acid Suppression Visual Aid',
    productName: 'PNCROS 40',
    fileUrl: '/uploads/content/Pncors-40-Generated.png',
    thumbnailUrl: '/uploads/content/Pncors-40-Generated.png',
    description: 'Pantoprazole 40mg enteric-coated tablet for rapid GERD & ulcer relief.',
    contentType: 'IMAGE',
  },
  {
    title: 'Pncros DSR - Dual Release Anti-Reflux Slide',
    productName: 'PNCROS DRS CAPSULE',
    fileUrl: '/uploads/content/Pncros-DSR-Generated.png',
    thumbnailUrl: '/uploads/content/Pncros-DSR-Generated.png',
    description: 'Pantoprazole + Domperidone sustained release for reflux & dyspepsia.',
    contentType: 'IMAGE',
  },
  {
    title: 'Rinovac Drops - Pediatric Nasal Decongestant Aid',
    productName: 'RINOVAC DROP',
    fileUrl: '/uploads/content/RinovacPlus-Drops-generated.png',
    thumbnailUrl: '/uploads/content/RinovacPlus-Drops-generated.png',
    description: 'Gentle pediatric cold relief drops for infants and young children.',
    contentType: 'IMAGE',
  },
  {
    title: 'Rinovac Plus Suspension - Cough & Cold Aid',
    productName: 'RINOVAC SUSPENSION',
    fileUrl: '/uploads/content/RinovacPlus-Generated.png',
    thumbnailUrl: '/uploads/content/RinovacPlus-Generated.png',
    description: 'Multi-action cold, cough, and congestion relief for family medicine.',
    contentType: 'IMAGE',
  },
  {
    title: 'Rinovac Tablet - Anti-Cold & Sinus Clinical Slide',
    productName: 'RINOVAC TABLET',
    fileUrl: '/uploads/content/RinovacTab-Generated.png',
    thumbnailUrl: '/uploads/content/RinovacTab-Generated.png',
    description: 'Non-sedating antihistamine and decongestant for active day relief.',
    contentType: 'IMAGE',
  },
  {
    title: 'Veepros D3 Capsule - 60,000 IU High Dose Vitamin D3',
    productName: 'VEEPROS D3 CAPSULE',
    fileUrl: '/uploads/content/Veepros-D3-Capsules-Generated.png',
    thumbnailUrl: '/uploads/content/Veepros-D3-Capsules-Generated.png',
    description: 'Weekly vitamin D3 therapy for hypovitaminosis D and immune support.',
    contentType: 'IMAGE',
  },
  {
    title: 'Veepros Sachet - Cholecalciferol Granules Presentation',
    productName: 'VEEPROS SACHET',
    fileUrl: '/uploads/content/Veepros-Sachets-Generated.png',
    thumbnailUrl: '/uploads/content/Veepros-Sachets-Generated.png',
    description: 'Pleasant-tasting vitamin D3 granules for water/milk reconstitution.',
    contentType: 'IMAGE',
  },
  {
    title: 'Veepros D3 Nano Shots - Instant Bioavailability Slide',
    productName: 'VEEPROS D3 NANOSHOTS',
    fileUrl: '/uploads/content/VeeprosD3-Nano-Shots-Generated.png',
    thumbnailUrl: '/uploads/content/VeeprosD3-Nano-Shots-Generated.png',
    description: 'Nanotechnology-based ready-to-drink sugar-free vitamin D3 oral solution.',
    contentType: 'IMAGE',
  },
];

const productImagesMap = {
  'HEMOVAC SYRUP': '/uploads/content/Haemovac-Syrup-Generated.png',
  'HEMOVAC TABLET': '/uploads/content/Haemovac-Syrup-Generated.png',
  'BIOSPORE SACHET': '/uploads/content/Biospore-Sachets-Generated.png',
  'BIOSPORE TABLET': '/uploads/content/Biospore-Tablets-Generated.png',
  'BIOSPORE 4 SACHET': '/uploads/content/Biospore4-generated.png',
  'BIOSPORE 4 TABLET': '/uploads/content/Biospore4-Tab-Generated.png',
  'PNCROS DRS CAPSULE': '/uploads/content/Pncros-DSR-Generated.png',
  'PNCROS 40': '/uploads/content/Pncors-40-Generated.png',
  'RINOVAC SUSPENSION': '/uploads/content/RinovacPlus-Generated.png',
  'RINOVAC TABLET': '/uploads/content/RinovacTab-Generated.png',
  'RINOVAC DROP': '/uploads/content/RinovacPlus-Drops-generated.png',
  'ALKATAGE 200 ml': '/uploads/content/Alkatage-Generated.png',
  'CALCICAL TABLET': '/uploads/content/Calcicall-Tablets-Generated.png',
  'BENZYLAC TABLET': '/uploads/content/Benzylac-generated.png',
  'BENZYLAC SYRUP': '/uploads/content/BenzylacAdvanced-Generated.png',
  'VEEPROS D3 CAPSULE': '/uploads/content/Veepros-D3-Capsules-Generated.png',
  'VEEPROS D3 NANOSHOTS': '/uploads/content/VeeprosD3-Nano-Shots-Generated.png',
  'VEEPROS SACHET': '/uploads/content/Veepros-Sachets-Generated.png',
  'BRENZ POWDER': '/uploads/content/Brenz-generated.png',
  'MONTECROS L': '/uploads/content/Montecros-L-Generated.png',
  'BIOFIT PLUS M': '/uploads/content/BioFitPlus-M-Generated.png',
  'BIOFIT PLUS F': '/uploads/content/BiofitPlus-F-Generated.png',
  'ARGICROS BLUE SACHET': '/uploads/content/Argicros-Pink-Generated.png',
  'ARGICROS PINK SACHET': '/uploads/content/Argicros-Pink-Generated.png',
};

async function main() {
  console.log('🚀 Starting Digital Detailing & Product Images Synchronization...\n');

  // 1. Ensure Campaign exists
  let campaign = await prisma.campaign.findFirst({
    where: { name: 'Biocros 2026 Core Detailing Campaign' }
  });

  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        name: 'Biocros 2026 Core Detailing Campaign',
        description: 'Core product detailing materials for doctors and healthcare specialists.',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        isActive: true,
      },
    });
    console.log(`✅ Created campaign: ${campaign.name} (${campaign.id})`);
  } else {
    console.log(`✅ Found existing campaign: ${campaign.name} (${campaign.id})`);
  }

  // 2. Upsert Digital Detailing Content
  let contentCount = 0;
  for (const c of digitalDetailingContents) {
    const existing = await prisma.content.findFirst({
      where: {
        OR: [
          { fileUrl: c.fileUrl },
          { title: c.title }
        ]
      }
    });

    if (existing) {
      await prisma.content.update({
        where: { id: existing.id },
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
        }
      });
    } else {
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
        }
      });
    }
    contentCount++;
  }
  console.log(`✅ Successfully synced ${contentCount} Digital Detailing Slides in database.`);

  // 3. Update Product Images
  let updatedProducts = 0;
  for (const [prodName, imgUrl] of Object.entries(productImagesMap)) {
    const res = await prisma.product.updateMany({
      where: { name: { equals: prodName, mode: 'insensitive' } },
      data: { productImage: imgUrl }
    });
    if (res.count > 0) {
      updatedProducts += res.count;
      console.log(`   📸 Linked image for ${prodName} -> ${imgUrl}`);
    }
  }
  console.log(`\n🎉 Total Products Updated with Images: ${updatedProducts}`);

  const totalContent = await prisma.content.count({ where: { isActive: true, isDisabled: false } });
  console.log(`📊 Active Digital Detailing Slides in System: ${totalContent}`);
}

main()
  .catch((err) => {
    console.error('❌ Error during digital detailing seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
