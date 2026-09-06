require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const schemesData = [
  { product: 'HEMOVAC SYRUP', packing: '300ML', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Hematology / Iron Supplement' },
  { product: 'HEMOVAC TABLET', packing: '30 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Hematology / Iron Supplement' },
  { product: 'BIOSPORE SACHET', packing: '50 Sachets', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Probiotic & Prebiotic' },
  { product: 'BIOSPORE TABLET', packing: '10 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Probiotic & Prebiotic' },
  { product: 'BIOSPORE 4 SACHET', packing: '50 Sachets', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'High-Potency Probiotic' },
  { product: 'BIOSPORE 4 TABLET', packing: '10 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'High-Potency Probiotic' },
  { product: 'PNCROS DRS CAPSULE', packing: '10 Caps', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Gastroenterology / PPI' },
  { product: 'PNCROS 40', packing: '10 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Gastroenterology / Pantoprazole' },
  { product: 'RINOVAC SUSPENSION', packing: '200ML', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Respiratory / Anti-Cold' },
  { product: 'RINOVAC TABLET', packing: '10 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Respiratory / Anti-Allergic' },
  { product: 'RINOVAC DROP', packing: '15ML', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Pediatric Respiratory' },
  { product: 'ALKATAGE 200 ml', packing: '200ML', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Nephrology / Urinary Alkalizer' },
  { product: 'CALCICAL TABLET', packing: '10 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Calcium & Bone Health' },
  { product: 'BENZYLAC TABLET', packing: '10 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Anti-infective' },
  { product: 'BENZYLAC SYRUP', packing: '200ML', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Anti-infective Syrup' },
  { product: 'VEEPROS D3 CAPSULE', packing: '4 Caps', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Vitamin D3 60,000 IU' },
  { product: 'VEEPROS D3 NANOSHOTS', packing: '4 Shots', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Nanotechnology D3 Solution' },
  { product: 'VEEPROS SACHET', packing: '20 Sachets', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Nutraceutical / Multivitamin' },
  { product: 'BRENZ POWDER', packing: '105GM', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Energy & Electrolyte' },
  { product: 'MONTECROS L', packing: '10 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Montelukast + Levocetirizine' },
  { product: 'BIOFIT PLUS M', packing: '10 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Men Daily Vitality' },
  { product: 'BIOFIT PLUS F', packing: '10 Tabs', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'Women Daily Wellness' },
  { product: 'ARGICROS BLUE SACHET', packing: '20 Sachets', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'L-Arginine Reproductive Support' },
  { product: 'ARGICROS PINK SACHET', packing: '20 Sachets', scheme: '10+1', minQty: 10, freeQty: 1, type: 'free_goods', category: 'L-Arginine Maternal Care' },
];

// Portfolio umbrella trade campaigns
const umbrellaSchemes = [
  {
    name: 'Biocros Annual Trade Privilege 2026',
    description: 'Universal 10+1 free goods trade scheme across all secondary retailer purchase orders on all 24 Biocros pharmaceutical formulations.',
    type: 'free_goods',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    targetRole: 'RETAILER',
    minPurchase: 10,
    reward: '1 Free Unit per 10 Units Ordered (10+1)',
    isActive: true
  },
  {
    name: 'Chemist Volume Loyalty Scheme',
    description: 'Chemist orders exceeding ₹25,000 monthly qualify for an additional 3% quarterly settlement rebate on verified off-take.',
    type: 'loyalty',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    targetRole: 'RETAILER',
    minPurchase: 25000,
    reward: '3% Cumulative Off-take Cashback',
    isActive: true
  },
  {
    name: 'Stockist Prompt Payment Incentive',
    description: 'Primary stockist dispatch invoices cleared within 7 business days receive a 2% spot cash discount.',
    type: 'cashback',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    targetRole: 'STOCKIST',
    minPurchase: 50000,
    reward: '2% Prompt Settlement Rebate',
    isActive: true
  },
  {
    name: 'Retail Pharmacy Shelf Display Incentive',
    description: 'Chemists dedicating premium counter shelf space to Biocros Veepros D3 & Biospore product range receive POS display merchandising incentive.',
    type: 'display_incentive',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    targetRole: 'RETAILER',
    minPurchase: 5000,
    reward: '₹500 Monthly Counter Display Incentive',
    isActive: true
  }
];

async function seedSchemes() {
  console.log('🌱 Seeding Trade Schemes from Biocros Product Scheme.xlsx ...');

  // Purge old schemes
  await prisma.scheme.deleteMany({});
  await prisma.tradeScheme.deleteMany({});

  const now = new Date('2026-01-01');
  const endOfYear = new Date('2026-12-31T23:59:59.999Z');

  // Seed Product Schemes
  let count = 0;
  for (const item of schemesData) {
    // 1. Seed into Scheme model (used by /api/v1/schemes & mobile schemes screen)
    await prisma.scheme.create({
      data: {
        name: `${item.product} - ${item.scheme} Trade Scheme`,
        description: `Order ${item.minQty} units of ${item.product} (${item.packing}) and receive ${item.freeQty} unit complimentary. Standard trade promotion for retail pharmacies & stockists. Category: ${item.category}.`,
        type: item.type,
        startDate: now,
        endDate: endOfYear,
        targetRole: 'ALL',
        minPurchase: item.minQty,
        reward: `${item.scheme} Free Goods (${item.packing})`,
        isActive: true
      }
    });

    // 2. Seed into TradeScheme model (used by order engine)
    await prisma.tradeScheme.create({
      data: {
        name: `${item.product} (${item.scheme})`,
        description: `Buy ${item.minQty} get ${item.freeQty} free on ${item.product} (${item.packing})`,
        discountType: 'FREE_ITEM',
        discountValue: item.freeQty,
        minQuantity: item.minQty,
        validFrom: now,
        validTo: endOfYear,
        isActive: true
      }
    });

    count++;
  }

  // Seed Umbrella Schemes
  for (const umb of umbrellaSchemes) {
    await prisma.scheme.create({
      data: umb
    });
  }

  const finalSchemeCount = await prisma.scheme.count();
  const finalTradeSchemeCount = await prisma.tradeScheme.count();

  console.log(`✅ Successfully seeded:`);
  console.log(`   - ${finalSchemeCount} Promotional Schemes into 'schemes' table`);
  console.log(`   - ${finalTradeSchemeCount} Trade Schemes into 'trade_schemes' table`);
}

seedSchemes()
  .catch(e => {
    console.error('❌ Error seeding schemes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
