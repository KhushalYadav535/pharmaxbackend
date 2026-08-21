import prisma from '../config/database';
import { VisitType } from '@prisma/client';

export interface DailyReportInput {
  hqId?: string;
  visitType: VisitType;
  doctorId?: string;
  hospitalId?: string;
  retailerId?: string;
  stockistId?: string;
  visitDate: string;
  visitPurpose?: string;
  visitFeedback?: string;
  nextVisit?: string;
  remarks?: string;
  jointVisit?: boolean;
  jointVisitWith?: string;
  productsPromoted?: string[];
  locationId?: string;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
}

export const dailyReportService = {
  async list(filters: any, userId: string, userRole: string) {
    const { page = 1, limit = 20, visitType, fromDate, toDate, doctorId, retailerId, stockistId, hospitalId } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (visitType) where.visitType = visitType;
    if (doctorId) where.doctorId = doctorId;
    if (retailerId) where.retailerId = retailerId;
    if (stockistId) where.stockistId = stockistId;
    if (hospitalId) where.hospitalId = hospitalId;
    if (fromDate || toDate) {
      where.visitDate = {};
      if (fromDate) where.visitDate.gte = new Date(fromDate);
      if (toDate) where.visitDate.lte = new Date(toDate);
    }
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(userRole)) {
      where.employeeId = userId;
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
          stockist: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { visitDate: 'desc' },
      }),
      prisma.dailyVisitReport.count({ where }),
    ]);
    return { reports, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.dailyVisitReport.findUnique({
      where: { id },
      include: {
        employee: true,
        hq: true,
        doctor: true,
        hospital: true,
        retailer: true,
        stockist: true,
        location: true,
      },
    });
  },

  async create(data: DailyReportInput, employeeId: string) {
    return prisma.dailyVisitReport.create({
      data: {
        employeeId,
        hqId: data.hqId,
        visitType: data.visitType,
        doctorId: data.doctorId,
        hospitalId: data.hospitalId,
        retailerId: data.retailerId,
        stockistId: data.stockistId,
        visitDate: new Date(data.visitDate),
        visitPurpose: data.visitPurpose,
        visitFeedback: data.visitFeedback,
        nextVisit: data.nextVisit ? new Date(data.nextVisit) : undefined,
        remarks: data.remarks,
        jointVisit: data.jointVisit ?? false,
        jointVisitWith: data.jointVisitWith,
        productsPromoted: data.productsPromoted ?? [],
        locationId: data.locationId,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        locationAddress: data.locationAddress,
      },
    });
  },

  async update(id: string, data: Partial<DailyReportInput>) {
    return prisma.dailyVisitReport.update({
      where: { id },
      data: {
        ...data,
        visitDate: data.visitDate ? new Date(data.visitDate) : undefined,
        nextVisit: data.nextVisit ? new Date(data.nextVisit) : undefined,
      },
    });
  },
};
