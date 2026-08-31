import prisma from '../config/database';

export const tourPlanService = {
  async list(filters: any) {
    const { page = 1, limit = 20, userId, status, hqId, planMonth } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (userId) where.userId = userId;
    if (hqId) where.hqId = hqId;
    if (status) where.approvalStatus = status;
    if (planMonth) where.planMonth = planMonth;

    const [tourPlans, total] = await Promise.all([
      prisma.tourPlan.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          hq: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } }
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: [
          { planMonth: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.tourPlan.count({ where })
    ]);

    return { tourPlans, total, page: p, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const tp = await prisma.tourPlan.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        hq: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
        days: {
          include: {
            area: { select: { id: true, name: true } },
            plannedVisits: {
              include: {
                doctor: { select: { id: true, firstName: true, lastName: true, specialty: true, classification: true } },
                hospital: { select: { id: true, name: true } },
                retailer: { select: { id: true, name: true } },
                stockist: { select: { id: true, name: true } },
                distributor: { select: { id: true, name: true } }
              }
            }
          },
          orderBy: { date: 'asc' }
        }
      }
    });
    if (!tp) throw new Error('Tour Plan not found');
    return tp;
  },

  async create(reqUserId: string, data: any) {
    const { planMonth, workingDays, tourFromDate, tourToDate, tourPurpose, jointVisit, jointVisitWith, hqId, locationId, areaId, userId } = data;
    
    if (!planMonth && !tourFromDate) {
      throw new Error('Either Plan Month or Tour From Date is required');
    }

    return prisma.tourPlan.create({
      data: {
        userId: userId || reqUserId, // Admins can assign to others
        hqId,
        locationId,
        areaId,
        planMonth,
        workingDays: workingDays ? Number(workingDays) : 0,
        tourFromDate: tourFromDate ? new Date(tourFromDate) : undefined,
        tourToDate: tourToDate ? new Date(tourToDate) : undefined,
        tourPurpose,
        jointVisit: Boolean(jointVisit),
        jointVisitWith,
        approvalStatus: 'PENDING'
      }
    });
  },

  async update(id: string, data: any) {
    const { tourFromDate, tourToDate, tourPurpose, jointVisit, jointVisitWith, hqId, locationId, areaId } = data;
    await this.getById(id);

    return prisma.tourPlan.update({
      where: { id },
      data: {
        hqId,
        locationId,
        areaId,
        tourFromDate: tourFromDate ? new Date(tourFromDate) : undefined,
        tourToDate: tourToDate !== undefined ? (tourToDate ? new Date(tourToDate) : null) : undefined,
        tourPurpose,
        jointVisit: jointVisit !== undefined ? Boolean(jointVisit) : undefined,
        jointVisitWith
      }
    });
  },

  async updateStatus(id: string, status: any) {
    if (!['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      throw new Error('Invalid status.');
    }
    await this.getById(id);
    
    // When MR submits (sets to PENDING after filling), record the submission timestamp
    const extraData: any = { approvalStatus: status };
    if (status === 'PENDING') {
      extraData.planDate = new Date(); // marks as "submitted for review"
    }
    
    return prisma.tourPlan.update({
      where: { id },
      data: extraData
    });
  },

  async delete(id: string) {
    await this.getById(id);
    return prisma.tourPlan.delete({ where: { id } });
  },

  // --- Monthly TP specific endpoints ---

  async addDay(tourPlanId: string, data: any) {
    return prisma.tourPlanDay.create({
      data: {
        tourPlanId,
        date: new Date(data.date),
        areaId: data.areaId,
        purpose: data.purpose
      }
    });
  },

  async bulkAddVisits(tourPlanDayId: string, userId: string, visits: any[]) {
    const day = await prisma.tourPlanDay.findUnique({ where: { id: tourPlanDayId }, include: { tourPlan: true } });
    if (!day) throw new Error('Tour plan day not found');

    const createdVisits = await Promise.all(visits.map(async (v) => {
      let visitType = 'DOCTOR';
      if (v.hospitalId) visitType = 'HOSPITAL';
      else if (v.retailerId) visitType = 'RETAILER';
      else if (v.stockistId) visitType = 'STOCKIST';
      else if (v.distributorId) visitType = 'DISTRIBUTOR';

      const sanitizeId = (id: any) => (!id || id === 'undefined' || id === 'null' || id === '') ? undefined : String(id);
      const sDoctorId = sanitizeId(v.doctorId) || null;
      const sHospitalId = sanitizeId(v.hospitalId) || null;
      const sRetailerId = sanitizeId(v.retailerId) || null;
      const sStockistId = sanitizeId(v.stockistId) || null;
      const sDistributorId = sanitizeId(v.distributorId) || null;

      // Debug check: verify existence if IDs are provided
      if (sRetailerId) {
        const exists = await prisma.retailer.findUnique({ where: { id: sRetailerId } });
        if (!exists) throw new Error(`Retailer ID ${sRetailerId} does not exist in the database! Frontend might be using cached/stale data.`);
      }
      if (sDoctorId) {
        const exists = await prisma.doctor.findUnique({ where: { id: sDoctorId } });
        if (!exists) throw new Error(`Doctor ID ${sDoctorId} does not exist in the database!`);
      }

      console.log('Inserting sanitized payload:', { doctorId: sDoctorId, retailerId: sRetailerId });

      return prisma.visit.create({
        data: {
          tourPlanDayId,
          userId,
          visitType: visitType as any,
          plannedDate: day.date,
          status: 'PLANNED',
          doctorId: sDoctorId,
          hospitalId: sHospitalId,
          retailerId: sRetailerId,
          stockistId: sStockistId,
          distributorId: sDistributorId,
          visitPurpose: day.purpose
        }
      });
    }));

    return createdVisits;
  },

  async copyDay(tourPlanId: string, sourceDayId: string, targetDate: string, reqUserId: string) {
    const sourceDay = await prisma.tourPlanDay.findUnique({
      where: { id: sourceDayId },
      include: { plannedVisits: true }
    });
    if (!sourceDay) throw new Error('Source day not found');
    
    // Check if target day already exists
    let targetDay = await prisma.tourPlanDay.findFirst({
      where: { tourPlanId, date: new Date(targetDate) }
    });

    if (!targetDay) {
      targetDay = await prisma.tourPlanDay.create({
        data: {
          tourPlanId,
          date: new Date(targetDate),
          areaId: sourceDay.areaId,
          purpose: sourceDay.purpose
        }
      });
    }

    const newVisits = sourceDay.plannedVisits.map(v => ({
      doctorId: v.doctorId,
      hospitalId: v.hospitalId,
      retailerId: v.retailerId,
      stockistId: v.stockistId,
      distributorId: v.distributorId
    }));

    if (newVisits.length > 0) {
      await this.bulkAddVisits(targetDay.id, reqUserId, newVisits);
    }

    return targetDay;
  },

  async copyMonth(newTourPlanId: string, sourceTourPlanId: string, reqUserId: string) {
    const sourceTp = await prisma.tourPlan.findUnique({
      where: { id: sourceTourPlanId },
      include: {
        days: {
          include: { plannedVisits: true }
        }
      }
    });
    
    if (!sourceTp) throw new Error('Source Tour Plan not found');

    const newTp = await prisma.tourPlan.findUnique({
      where: { id: newTourPlanId }
    });

    if (!newTp || !newTp.planMonth) throw new Error('New Tour Plan not found or missing planMonth');

    // Parse YYYY-MM
    const [nyYear, nyMonth] = newTp.planMonth.split('-').map(Number);

    for (const sourceDay of sourceTp.days) {
      // Find the day number (1-31) of the source day
      const dayNum = sourceDay.date.getDate();

      // Ensure the day is valid for the target month (e.g. Feb 30th -> skip or cap at 28)
      const targetDate = new Date(nyYear, nyMonth - 1, dayNum, 12, 0, 0);
      if (targetDate.getMonth() + 1 !== nyMonth) continue; // Skip invalid days for short months

      // Create the target day
      const newDay = await prisma.tourPlanDay.create({
        data: {
          tourPlanId: newTourPlanId,
          date: targetDate,
          areaId: sourceDay.areaId,
          purpose: sourceDay.purpose
        }
      });

      // Copy visits
      const newVisits = sourceDay.plannedVisits.map(v => ({
        doctorId: v.doctorId,
        hospitalId: v.hospitalId,
        retailerId: v.retailerId,
        stockistId: v.stockistId,
        distributorId: v.distributorId
      }));

      if (newVisits.length > 0) {
        await this.bulkAddVisits(newDay.id, reqUserId, newVisits);
      }
    }

    return { success: true };
  },

  async getCoverage(id: string) {
    const tp = await prisma.tourPlan.findUnique({
      where: { id },
      include: {
        days: {
          include: {
            plannedVisits: {
              where: { visitType: 'DOCTOR' },
              include: {
                doctor: { select: { id: true, classification: true } }
              }
            }
          }
        }
      }
    });

    if (!tp) throw new Error('Tour Plan not found');

    // Collect all planned doctor IDs (unique) and their classifications
    const plannedDoctorMap: Record<string, string> = {};
    for (const day of tp.days) {
      for (const visit of day.plannedVisits) {
        if (visit.doctor?.id) {
          plannedDoctorMap[visit.doctor.id] = visit.doctor.classification;
        }
      }
    }

    // Count total eligible doctors by classification for this HQ
    const classifications = ['A_PLUS', 'A', 'B', 'C'] as const;
    const coverageResult: Record<string, { planned: number; total: number }> = {};

    for (const cls of classifications) {
      const total = await prisma.doctor.count({
        where: {
          hqId: tp.hqId ?? undefined,
          classification: cls
        }
      });

      const planned = Object.values(plannedDoctorMap).filter(c => c === cls).length;

      // Map A_PLUS -> A+ for display
      const displayKey = cls === 'A_PLUS' ? 'A+' : cls;
      coverageResult[displayKey] = { planned, total };
    }

    return { doctors: coverageResult };
  }
};
