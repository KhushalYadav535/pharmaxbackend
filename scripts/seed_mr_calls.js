require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Seeding Realistic Field Calls for MR Telemetry ---');

  const mrs = await prisma.user.findMany({
    where: { role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'] } },
    select: { id: true, firstName: true, lastName: true },
  });

  const doctors = await prisma.doctor.findMany({
    take: 60,
    select: { id: true, firstName: true, lastName: true, specialty: true },
  });

  const retailers = await prisma.retailer.findMany({
    take: 9,
    select: { id: true, name: true, city: true },
  });

  if (doctors.length === 0) {
    console.log('No doctors found. Cannot seed calls.');
    return;
  }

  const productsList = [
    'Biocros Amoxy-Clav 625',
    'Cros-Pan DSR 40mg',
    'Bio-Cef 200 DT',
    'Cros-Mont LC Kid Syrup',
    'Biocros Paracetamol 650',
    'Cros-Azith 500 Tablets',
    'Biocros Multivitamin Gold',
    'Cros-Dolo Cold Relief',
  ];

  const purposes = [
    'Product Launch Presentation & Detailing',
    'Prescription Audit & Feedback',
    'Sample Handover & Brochure Detailing',
    'Quarterly Relationship Call & Detailing',
    'New SKU Introduction & Order Booking',
    'Chemist Stockist Liquidation Audit',
  ];

  const feedbacks = [
    'Doctor committed 15 prescriptions this month for Biocros Amoxy-Clav.',
    'Doctor requested clinical trial samples for Cros-Pan DSR.',
    'Very positive response on patient compliance with new film-coated tablets.',
    'Chemist confirmed high counter demand, stockist pending reorder.',
    'Detailed 3 key products, doctor appreciated the new packaging.',
    'Doctor asked for follow-up next week after clinical review.',
  ];

  const now = new Date();
  let createdCount = 0;

  for (let i = 0; i < mrs.length; i++) {
    const mr = mrs[i];

    // For past 7 days plus today
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const callDate = new Date(now);
      callDate.setDate(callDate.getDate() - daysAgo);

      // Skip Sundays occasionally
      if (callDate.getDay() === 0 && (i % 2 === 0)) continue;

      // 3 to 6 calls per day
      const callCount = daysAgo === 0 ? 3 : (3 + (i + daysAgo) % 3);

      for (let c = 0; c < callCount; c++) {
        const isDoctor = c % 4 !== 3; // 75% doctor calls, 25% chemist calls
        const docIndex = (i * 7 + daysAgo * 4 + c) % doctors.length;
        const retIndex = (i * 3 + c) % (retailers.length || 1);

        const callHour = 10 + c * 2;
        const callMinute = (c * 17) % 60;

        const plannedDate = new Date(callDate);
        plannedDate.setHours(callHour, callMinute, 0, 0);

        // If today and hour is beyond current time, mark as PLANNED
        const isFutureToday = daysAgo === 0 && plannedDate.getTime() > now.getTime();
        const status = isFutureToday ? 'PLANNED' : 'REPORTED';

        const checkInTime = isFutureToday ? null : new Date(plannedDate.getTime() + 5 * 60000);
        const durationMinutes = isFutureToday ? null : (15 + ((c * 7) % 25));
        const checkOutTime = isFutureToday || !checkInTime ? null : new Date(checkInTime.getTime() + durationMinutes * 60000);

        const promotedCount = 2 + (c % 3);
        const promoted = productsList.slice(c % 4, (c % 4) + promotedCount);

        const data = {
          visitType: isDoctor ? 'DOCTOR' : 'RETAILER',
          status: status,
          userId: mr.id,
          plannedDate: plannedDate,
          checkInTime: checkInTime,
          checkOutTime: checkOutTime,
          reportSubmittedAt: checkOutTime,
          durationMinutes: durationMinutes,
          visitPurpose: purposes[(i + c) % purposes.length],
          visitFeedback: isFutureToday ? null : feedbacks[(i + c) % feedbacks.length],
          productsPromoted: promoted,
          ...(isDoctor
            ? { doctorId: doctors[docIndex].id }
            : { retailerId: retailers[retIndex]?.id || null }),
        };

        await prisma.visit.create({ data });
        createdCount++;
      }
    }
  }

  console.log(`Successfully seeded ${createdCount} realistic field calls across ${mrs.length} MRs!`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => pool.end());
