import prisma from '../config/database';

export const dailyReportService = {
  async list(filters: any) {
    const { page = 1, limit = 20, employeeId, hqId, visitType, startDate, endDate } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (hqId) where.hqId = hqId;
    if (visitType) where.visitType = visitType;
    
    if (startDate || endDate) {
      where.visitDate = {};
      if (startDate) where.visitDate.gte = new Date(startDate);
      if (endDate) where.visitDate.lte = new Date(endDate);
    }

    const [reports, total] = await Promise.all([
      prisma.dailyVisitReport.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          hq: { select: { id: true, name: true } },
          doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          hospital: { select: { id: true, name: true } },
          retailer: { select: { id: true, name: true } },
          stockist: { select: { id: true, name: true } }
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { visitDate: 'desc' }
      }),
      prisma.dailyVisitReport.count({ where })
    ]);

    return { reports, total, page: p, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const report = await prisma.dailyVisitReport.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        hq: { select: { id: true, name: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        hospital: { select: { id: true, name: true } },
        retailer: { select: { id: true, name: true } },
        stockist: { select: { id: true, name: true } }
      }
    });
    if (!report) throw new Error('Daily Report not found');
    return report;
  },

  async create(reqUserId: string, data: any) {
    const { 
      visitType, hqId, doctorId, hospitalId, retailerId, stockistId,
      visitDate, visitPurpose, visitFeedback, nextVisit, remarks,
      jointVisit, jointVisitWith, productsPromoted,
      locationLat, locationLng, locationAddress, employeeId
    } = data;
    
    if (!visitType || !visitDate) {
      throw new Error('Visit Type and Visit Date are required');
    }

    // Validation for specific visit types
    if (visitType === 'DOCTOR' && !doctorId) throw new Error('Doctor must be selected for Doctor visit');
    if (visitType === 'HOSPITAL' && !hospitalId) throw new Error('Hospital must be selected for Hospital visit');
    if (visitType === 'RETAILER' && !retailerId) throw new Error('Retailer must be selected for Retailer visit');
    if (visitType === 'STOCKIST' && !stockistId) throw new Error('Stockist must be selected for Stockist visit');

    return prisma.dailyVisitReport.create({
      data: {
        employeeId: employeeId || reqUserId, // Admins can log for others
        hqId,
        visitType,
        doctorId: visitType === 'DOCTOR' ? doctorId : undefined,
        hospitalId: visitType === 'HOSPITAL' ? hospitalId : undefined,
        retailerId: visitType === 'RETAILER' ? retailerId : undefined,
        stockistId: visitType === 'STOCKIST' ? stockistId : undefined,
        visitDate: new Date(visitDate),
        visitPurpose,
        visitFeedback,
        nextVisit: nextVisit ? new Date(nextVisit) : undefined,
        remarks,
        jointVisit: Boolean(jointVisit),
        jointVisitWith,
        productsPromoted: Array.isArray(productsPromoted) ? productsPromoted : [],
        locationLat: locationLat ? parseFloat(locationLat) : undefined,
        locationLng: locationLng ? parseFloat(locationLng) : undefined,
        locationAddress
      }
    });
  },

  async update(id: string, data: any) {
    await this.getById(id);
    
    const { 
      visitType, hqId, doctorId, hospitalId, retailerId, stockistId,
      visitDate, visitPurpose, visitFeedback, nextVisit, remarks,
      jointVisit, jointVisitWith, productsPromoted,
      locationLat, locationLng, locationAddress 
    } = data;

    return prisma.dailyVisitReport.update({
      where: { id },
      data: {
        hqId,
        visitType,
        doctorId: visitType === 'DOCTOR' ? doctorId : null,
        hospitalId: visitType === 'HOSPITAL' ? hospitalId : null,
        retailerId: visitType === 'RETAILER' ? retailerId : null,
        stockistId: visitType === 'STOCKIST' ? stockistId : null,
        visitDate: visitDate ? new Date(visitDate) : undefined,
        visitPurpose,
        visitFeedback,
        nextVisit: nextVisit !== undefined ? (nextVisit ? new Date(nextVisit) : null) : undefined,
        remarks,
        jointVisit: jointVisit !== undefined ? Boolean(jointVisit) : undefined,
        jointVisitWith,
        productsPromoted: Array.isArray(productsPromoted) ? productsPromoted : undefined,
        locationLat: locationLat ? parseFloat(locationLat) : undefined,
        locationLng: locationLng ? parseFloat(locationLng) : undefined,
        locationAddress
      }
    });
  },

  async delete(id: string) {
    await this.getById(id);
    return prisma.dailyVisitReport.delete({ where: { id } });
  }
};
