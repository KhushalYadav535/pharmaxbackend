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
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        where.visitDate.gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        where.visitDate.lte = e;
      }
    }

    // Filters for Visit table
    const visitWhere: any = {};
    if (employeeId) visitWhere.userId = employeeId;
    if (visitType) visitWhere.visitType = visitType;
    if (startDate || endDate) {
      visitWhere.plannedDate = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        visitWhere.plannedDate.gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        visitWhere.plannedDate.lte = e;
      }
    }

    const [dailyCount, visitCount] = await Promise.all([
      prisma.dailyVisitReport.count({ where }),
      prisma.visit.count({ where: visitWhere })
    ]);

    // If no records in dailyVisitReport, paginate directly on Visit
    if (dailyCount === 0) {
      const visits = await prisma.visit.findMany({
        where: visitWhere,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          hospital: { select: { id: true, name: true } },
          retailer: { select: { id: true, name: true } },
          stockist: { select: { id: true, name: true } },
          distributor: { select: { id: true, name: true } }
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { plannedDate: 'desc' }
      });

      const mapped = visits.map((v: any) => ({
        id: v.id,
        employeeId: v.userId,
        employee: v.user ? {
          id: v.user.id,
          firstName: v.user.firstName,
          lastName: v.user.lastName,
          employeeId: v.user.employeeId,
          employeeCode: v.user.employeeId
        } : null,
        visitDate: v.plannedDate || v.checkInTime || v.createdAt,
        visitType: v.visitType,
        doctorId: v.doctorId,
        doctor: v.doctor,
        hospitalId: v.hospitalId,
        hospital: v.hospital,
        retailerId: v.retailerId,
        retailer: v.retailer,
        stockistId: v.stockistId || v.distributorId,
        stockist: v.stockist || v.distributor,
        visitPurpose: v.visitPurpose || (v.visitObjective && v.visitObjective.length ? v.visitObjective.join(', ') : null),
        visitFeedback: v.visitFeedback || v.doctorFeedback || v.notes || (v.objectionsRaised ? `Objections: ${v.objectionsRaised}` : null),
        nextVisit: v.nextVisit || v.nextFollowUpDate,
        remarks: v.remarks,
        jointVisit: v.jointVisit,
        jointVisitWith: v.jointVisitWith,
        productsPromoted: v.productsPromoted || v.productsDiscussed || [],
        locationLat: v.checkInLat,
        locationLng: v.checkInLng,
        locationAddress: v.checkInAddress,
        status: v.status
      }));

      return { reports: mapped, total: visitCount, page: p, totalPages: Math.ceil(visitCount / l) };
    }

    // Both tables have records - query both and merge
    const [dailyReports, visits] = await Promise.all([
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
        orderBy: { visitDate: 'desc' }
      }),
      prisma.visit.findMany({
        where: visitWhere,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          hospital: { select: { id: true, name: true } },
          retailer: { select: { id: true, name: true } },
          stockist: { select: { id: true, name: true } },
          distributor: { select: { id: true, name: true } }
        },
        orderBy: { plannedDate: 'desc' }
      })
    ]);

    const mappedVisits = visits.map((v: any) => ({
      id: v.id,
      employeeId: v.userId,
      employee: v.user ? {
        id: v.user.id,
        firstName: v.user.firstName,
        lastName: v.user.lastName,
        employeeId: v.user.employeeId,
        employeeCode: v.user.employeeId
      } : null,
      visitDate: v.plannedDate || v.checkInTime || v.createdAt,
      visitType: v.visitType,
      doctorId: v.doctorId,
      doctor: v.doctor,
      hospitalId: v.hospitalId,
      hospital: v.hospital,
      retailerId: v.retailerId,
      retailer: v.retailer,
      stockistId: v.stockistId || v.distributorId,
      stockist: v.stockist || v.distributor,
      visitPurpose: v.visitPurpose || (v.visitObjective && v.visitObjective.length ? v.visitObjective.join(', ') : null),
      visitFeedback: v.visitFeedback || v.doctorFeedback || v.notes || (v.objectionsRaised ? `Objections: ${v.objectionsRaised}` : null),
      nextVisit: v.nextVisit || v.nextFollowUpDate,
      remarks: v.remarks,
      jointVisit: v.jointVisit,
      jointVisitWith: v.jointVisitWith,
      productsPromoted: v.productsPromoted || v.productsDiscussed || [],
      locationLat: v.checkInLat,
      locationLng: v.checkInLng,
      locationAddress: v.checkInAddress,
      status: v.status
    }));

    const combined = [...dailyReports, ...mappedVisits].sort((a, b) => {
      const tA = new Date(a.visitDate).getTime();
      const tB = new Date(b.visitDate).getTime();
      return tB - tA;
    });

    const total = combined.length;
    const paginated = combined.slice((p - 1) * l, p * l);

    return { reports: paginated, total, page: p, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const report = await prisma.dailyVisitReport.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        hq: { select: { id: true, name: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        hospital: { select: { id: true, name: true } },
        retailer: { select: { id: true, name: true } },
        stockist: { select: { id: true, name: true } }
      }
    });
    if (report) return report;

    const v = await prisma.visit.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        hospital: { select: { id: true, name: true } },
        retailer: { select: { id: true, name: true } },
        stockist: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } }
      }
    });
    if (!v) throw new Error('Daily Report not found');

    return {
      id: v.id,
      employeeId: v.userId,
      employee: v.user ? {
        id: v.user.id,
        firstName: v.user.firstName,
        lastName: v.user.lastName,
        employeeId: v.user.employeeId,
        employeeCode: v.user.employeeId
      } : null,
      visitDate: v.plannedDate || v.checkInTime || v.createdAt,
      visitType: v.visitType,
      doctorId: v.doctorId,
      doctor: v.doctor,
      hospitalId: v.hospitalId,
      hospital: v.hospital,
      retailerId: v.retailerId,
      retailer: v.retailer,
      stockistId: v.stockistId || v.distributorId,
      stockist: v.stockist || v.distributor,
      visitPurpose: v.visitPurpose || (v.visitObjective && v.visitObjective.length ? v.visitObjective.join(', ') : null),
      visitFeedback: v.visitFeedback || v.doctorFeedback || v.notes || (v.objectionsRaised ? `Objections: ${v.objectionsRaised}` : null),
      nextVisit: v.nextVisit || v.nextFollowUpDate,
      remarks: v.remarks,
      jointVisit: v.jointVisit,
      jointVisitWith: v.jointVisitWith,
      productsPromoted: v.productsPromoted || v.productsDiscussed || [],
      locationLat: v.checkInLat,
      locationLng: v.checkInLng,
      locationAddress: v.checkInAddress,
      status: v.status
    };
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

    if (visitType === 'DOCTOR' && !doctorId) throw new Error('Doctor must be selected for Doctor visit');
    if (visitType === 'HOSPITAL' && !hospitalId) throw new Error('Hospital must be selected for Hospital visit');
    if (visitType === 'RETAILER' && !retailerId) throw new Error('Retailer must be selected for Retailer visit');
    if (visitType === 'STOCKIST' && !stockistId) throw new Error('Stockist must be selected for Stockist visit');

    return prisma.dailyVisitReport.create({
      data: {
        employeeId: employeeId || reqUserId,
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
    const report = await prisma.dailyVisitReport.findUnique({ where: { id } });
    if (report) {
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
    }

    const visit = await prisma.visit.findUnique({ where: { id } });
    if (visit) {
      return prisma.visit.update({
        where: { id },
        data: {
          visitPurpose: data.visitPurpose,
          visitFeedback: data.visitFeedback,
          remarks: data.remarks,
          nextVisit: data.nextVisit ? new Date(data.nextVisit) : undefined,
          productsPromoted: Array.isArray(data.productsPromoted) ? data.productsPromoted : undefined
        }
      });
    }

    throw new Error('Daily Report not found');
  },

  async delete(id: string) {
    const report = await prisma.dailyVisitReport.findUnique({ where: { id } });
    if (report) {
      return prisma.dailyVisitReport.delete({ where: { id } });
    }
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (visit) {
      return prisma.visit.delete({ where: { id } });
    }
    throw new Error('Daily Report not found');
  }
};
