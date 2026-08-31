import prisma from '../config/database';
import { Prisma, VisitStatus, VisitType, ApprovalStatus } from '@prisma/client';

// Recursively get all subordinate user IDs (direct + indirect reportees)
async function getHierarchyIds(managerId: string): Promise<string[]> {
  const directReports = await prisma.user.findMany({
    where: { managerId, isActive: true },
    select: { id: true },
  });
  const ids: string[] = directReports.map((r) => r.id);
  for (const r of directReports) {
    const sub = await getHierarchyIds(r.id);
    ids.push(...sub);
  }
  return ids;
}

export interface CreateVisitInput {
  visitType: VisitType;
  plannedDate: string;
  doctorId?: string;
  hospitalId?: string;
  retailerId?: string;
  distributorId?: string;
  productsDiscussed?: string[];
  notes?: string;
  nextFollowUpDate?: string;
}

export interface CheckInInput {
  lat: number;
  lng: number;
  address?: string;
}

export const visitService = {
  async list(filters: any, userId: string, userRole: string) {
    let { page = 1, limit = 20, status, visitType, fromDate, toDate, doctorId } = filters;
    page = Number(page) || 1;
    limit = Number(limit) || 20;

    const where: Prisma.VisitWhereInput = {
      ...(status && { status }),
      ...(visitType && { visitType }),
      ...(doctorId && { doctorId }),
      ...(fromDate || toDate
        ? { plannedDate: { gte: fromDate ? new Date(fromDate) : undefined, lte: toDate ? new Date(toDate) : undefined } }
        : {}),
    };

    // Reps see only their own visits; managers see team
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(userRole)) {
      where.userId = userId;
    } else if (['ASM', 'RSM', 'ZM', 'NSM'].includes(userRole)) {
      const reportIds = await prisma.user.findMany({
        where: { managerId: userId, isActive: true },
        select: { id: true },
      });
      where.userId = { in: [userId, ...reportIds.map((r) => r.id)] };
    }

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          retailer: { select: { id: true, name: true } },
          distributor: { select: { id: true, name: true } },
          hospital: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { plannedDate: 'desc' },
      }),
      prisma.visit.count({ where }),
    ]);

    return { visits, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async listTeam(filters: any, userId: string, userRole: string) {
    let { page = 1, limit = 30, status, visitType, fromDate, toDate, mrId } = filters;
    page = Number(page) || 1;
    limit = Number(limit) || 30;

    const where: Prisma.VisitWhereInput = {
      ...(status && { status }),
      ...(visitType && { visitType }),
      ...(mrId && { userId: mrId }),
      ...(fromDate || toDate
        ? { plannedDate: { gte: fromDate ? new Date(fromDate) : undefined, lte: toDate ? new Date(toDate) : undefined } }
        : {}),
    };

    // Build hierarchy-based userId filter (unless mrId already set)
    if (!mrId) {
      if (['SUPER_ADMIN', 'SALES_ADMIN'].includes(userRole)) {
        // See all visits — no userId filter
      } else if (['NSM', 'ZM', 'RSM', 'ASM'].includes(userRole)) {
        // Recursively fetch all reportees
        const allReporteeIds = await getHierarchyIds(userId);
        where.userId = { in: allReporteeIds };
      } else {
        // MR/TRADE_REP — not allowed to use this endpoint
        throw new Error('Access denied');
      }
    }

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true, employeeId: true } },
          doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          retailer: { select: { id: true, name: true, city: true } },
          distributor: { select: { id: true, name: true, city: true } },
          hospital: { select: { id: true, name: true, city: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { plannedDate: 'desc' },
      }),
      prisma.visit.count({ where }),
    ]);

    return { visits, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getTeamMembers(userId: string, userRole: string) {
    if (['SUPER_ADMIN', 'SALES_ADMIN'].includes(userRole)) {
      return prisma.user.findMany({
        where: { isActive: true, role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP', 'ASM', 'RSM', 'ZM', 'NSM'] } },
        select: { id: true, firstName: true, lastName: true, role: true, employeeId: true },
        orderBy: { firstName: 'asc' },
      });
    }
    const ids = await getHierarchyIds(userId);
    return prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true, employeeId: true },
      orderBy: { firstName: 'asc' },
    });
  },

  async getById(id: string) {
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, employeeId: true } },
        doctor: {
          include: { hospital: { select: { id: true, name: true, city: true } } },
        },
        retailer: true,
        distributor: true,
        hospital: true,
        attachments: true,
        sampleDistributions: { include: { sampleProduct: true } },
        orders: { include: { items: { include: { product: true } } } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!visit) throw new Error('Visit not found');

    let lastVisit = null;
    if (visit.doctorId || visit.hospitalId || visit.retailerId || visit.distributorId) {
      lastVisit = await prisma.visit.findFirst({
        where: {
          status: 'COMPLETED',
          plannedDate: { lt: visit.plannedDate },
          ...(visit.doctorId && { doctorId: visit.doctorId }),
          ...(visit.hospitalId && { hospitalId: visit.hospitalId }),
          ...(visit.retailerId && { retailerId: visit.retailerId }),
          ...(visit.distributorId && { distributorId: visit.distributorId }),
        },
        orderBy: { plannedDate: 'desc' },
      });
    }

    return { ...visit, lastVisit };
  },

  async updateNotes(id: string, notes: string) {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new Error('Visit not found');
    
    // Append the new note to existing notes if there are any
    const updatedNotes = visit.notes ? `${visit.notes}\n\n${notes}` : notes;
    
    return prisma.visit.update({
      where: { id },
      data: { notes: updatedNotes },
    });
  },

  async create(data: CreateVisitInput, userId: string) {
    return prisma.visit.create({
      data: {
        visitType: data.visitType,
        plannedDate: new Date(data.plannedDate),
        userId,
        doctorId: data.doctorId,
        hospitalId: data.hospitalId,
        retailerId: data.retailerId,
        distributorId: data.distributorId,
        productsDiscussed: data.productsDiscussed || [],
        notes: data.notes,
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
        status: VisitStatus.PLANNED,
        approvalStatus: ApprovalStatus.PENDING,
      },
    });
  },

  async checkIn(id: string, input: CheckInInput) {
    return prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.CHECKED_IN,
        checkInTime: new Date(),
        checkInLat: input.lat,
        checkInLng: input.lng,
        checkInAddress: input.address,
      },
    });
  },

  async checkOut(id: string, input: CheckInInput & { notes?: string; productsDiscussed?: string[]; objectionsRaised?: string; nextFollowUpDate?: string; visitObjective?: string[]; engagement?: string; businessSignal?: string[]; followUpAction?: string }) {
    const visit = await prisma.visit.findUnique({ where: { id }, select: { checkInTime: true } });
    const checkOutTime = new Date();
    const durationMinutes = visit?.checkInTime
      ? Math.round((checkOutTime.getTime() - visit.checkInTime.getTime()) / 60000)
      : undefined;

    return prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.COMPLETED,
        checkOutTime,
        checkOutLat: input.lat,
        checkOutLng: input.lng,
        durationMinutes,
        notes: input.notes,
        productsDiscussed: input.productsDiscussed,
        objectionsRaised: input.objectionsRaised,
        nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : undefined,
        visitObjective: input.visitObjective || [],
        engagement: input.engagement,
        businessSignal: input.businessSignal || [],
        followUpAction: input.followUpAction,
      },
    });
  },

  async approve(id: string, approverId: string, reason?: string) {
    return prisma.visit.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });
  },

  async reject(id: string, approverId: string, reason: string) {
    return prisma.visit.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedById: approverId,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });
  },

  async getTodayStats(userId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const [planned, completed, pending] = await Promise.all([
      prisma.visit.count({ where: { userId, plannedDate: { gte: startOfDay, lte: endOfDay } } }),
      prisma.visit.count({ where: { userId, plannedDate: { gte: startOfDay, lte: endOfDay }, status: 'COMPLETED' } }),
      prisma.visit.count({ where: { userId, approvalStatus: 'PENDING', status: 'COMPLETED' } }),
    ]);

    return { planned, completed, pending, missed: planned - completed };
  },
};
