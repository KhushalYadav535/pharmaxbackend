import prisma from '../config/database';

export const tourPlanService = {
  async list(filters: any) {
    const { page = 1, limit = 20, userId, status, hqId } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (userId) where.userId = userId;
    if (hqId) where.hqId = hqId;
    if (status) where.approvalStatus = status;

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
        orderBy: { tourFromDate: 'desc' }
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
        area: { select: { id: true, name: true } }
      }
    });
    if (!tp) throw new Error('Tour Plan not found');
    return tp;
  },

  async create(reqUserId: string, data: any) {
    const { tourFromDate, tourToDate, tourPurpose, jointVisit, jointVisitWith, hqId, locationId, areaId, userId } = data;
    
    if (!tourFromDate || !tourPurpose) {
      throw new Error('Tour From Date and Tour Purpose are required');
    }

    return prisma.tourPlan.create({
      data: {
        userId: userId || reqUserId, // Admins can assign to others
        hqId,
        locationId,
        areaId,
        tourFromDate: new Date(tourFromDate),
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
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error('Invalid status. Must be APPROVED or REJECTED.');
    }
    await this.getById(id);
    return prisma.tourPlan.update({
      where: { id },
      data: { approvalStatus: status }
    });
  },

  async delete(id: string) {
    await this.getById(id);
    return prisma.tourPlan.delete({ where: { id } });
  }
};
