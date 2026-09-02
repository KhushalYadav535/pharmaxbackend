import prisma from '../config/database';
import { Prisma, VisitStatus, VisitType, ApprovalStatus } from '@prisma/client';
import { ACTIVE_VISIT_STATUSES } from './day.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayEnd() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

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

// Haversine formula to calculate distance in meters between two lat/lng points
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (val: number) => val * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Input Types ───────────────────────────────────────────────────────────────

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
  isUnplanned?: boolean;
  unplannedReason?: string;
}

export interface CheckInInput {
  lat: number;
  lng: number;
  address?: string;
  gpsAccuracy?: number;
}

export interface CheckOutInput {
  lat: number;
  lng: number;
}

export interface SubmitReportInput {
  feedback?: string;
  engagement?: string;
  followUpAction?: string;
  nextFollowUpDate?: string;
  notes?: string;
  objectionsRaised?: string;
  businessSignal?: string[];
  visitObjective?: string[];
  productsDiscussed?: string[];
}

export interface MarkMissedInput {
  missedReason: string;
}

// ── Visit Service ─────────────────────────────────────────────────────────────

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
          retailer: { select: { id: true, name: true, city: true, address: true } },
          distributor: { select: { id: true, name: true, city: true, address: true } },
          hospital: { select: { id: true, name: true, city: true, address: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { plannedDate: 'asc' },
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

    if (!mrId) {
      if (['SUPER_ADMIN', 'SALES_ADMIN'].includes(userRole)) {
        // See all
      } else if (['NSM', 'ZM', 'RSM', 'ASM'].includes(userRole)) {
        const allReporteeIds = await getHierarchyIds(userId);
        where.userId = { in: allReporteeIds };
      } else {
        throw new Error('Access denied');
      }
    }

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true, employeeId: true } },
          doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          retailer: { select: { id: true, name: true, city: true, address: true } },
          distributor: { select: { id: true, name: true, city: true, address: true } },
          hospital: { select: { id: true, name: true, city: true, address: true } },
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
            include: {
              hospital: { select: { id: true, name: true, city: true } },
              // Include doctor's product associations for detailing step (Gap #12)
              productsSelected: { include: { product: { select: { id: true, name: true } } } },
            },
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
          status: { in: ['REPORTED', 'COMPLETED'] }, // both for backward compat
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
    const updatedNotes = visit.notes ? `${visit.notes}\n\n${notes}` : notes;
    return prisma.visit.update({ where: { id }, data: { notes: updatedNotes } });
  },

  async create(data: CreateVisitInput, userId: string) {
    // Gap #4 fix (§29): Block new visit creation when today's day is already CLOSED
    const today = todayStart();
    const todayAttendance = await prisma.attendance.findFirst({
      where: { userId, date: today },
      select: { dayStatus: true },
    });
    if (todayAttendance?.dayStatus === 'CLOSED') {
      throw new Error('Your day is closed. You cannot plan new visits for today.');
    }

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
        isUnplanned: data.isUnplanned || false,
        unplannedReason: data.unplannedReason,
        status: VisitStatus.PLANNED,
        approvalStatus: ApprovalStatus.PENDING,
      },
    });
  },

  // ── §6 Navigate — PLANNED / NAVIGATING → NAVIGATING ──────────────────
  async navigate(id: string, userId: string) {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new Error('Visit not found');
    if (visit.userId !== userId) throw new Error('Access denied');
    // Gap #6 fix: allow re-navigate from NAVIGATING (MR may have dismissed and returned)
    if (!['PLANNED', 'NAVIGATING'].includes(visit.status)) {
      throw new Error(`Cannot navigate: visit is currently ${visit.status}. Must be PLANNED or NAVIGATING.`);
    }
    return prisma.visit.update({ where: { id }, data: { status: VisitStatus.NAVIGATING } });
  },

  // ── §6 Check-in — PLANNED/NAVIGATING → CHECKED_IN (with guards) ──────────
  async checkIn(id: string, userId: string, input: CheckInInput) {
    // Guard 1: Day must be IN_PROGRESS
    const today = todayStart();
    const attendance = await prisma.attendance.findFirst({ where: { userId, date: today } });
    if (!attendance) {
      throw new Error('You have not started your day. Please start your day before checking in.');
    }
    if (attendance.dayStatus === 'CLOSED') {
      throw new Error('Your day is closed. You cannot check in to any visit.');
    }
    if (attendance.dayStatus === 'NOT_STARTED') {
      throw new Error('Please start your day before checking in.');
    }

    // Guard 2: One active visit at a time (§8)
    const end = todayEnd();
    const activeVisit = await prisma.visit.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_VISIT_STATUSES as any },
        plannedDate: { gte: today, lte: end },
      },
    });
    if (activeVisit) {
      throw new Error('You already have an active visit in progress. Complete it before starting a new one.');
    }

    // Guard 3: Visit must be PLANNED or NAVIGATING
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { doctor: true, retailer: true, hospital: true },
    });
    if (!visit) throw new Error('Visit not found');
    if (visit.userId !== userId) throw new Error('Access denied');
    if (!['PLANNED', 'NAVIGATING'].includes(visit.status)) {
      throw new Error(`Cannot check in: visit is currently ${visit.status}. Must be PLANNED or NAVIGATING.`);
    }

    // Guard 4: Geo-fencing (§7)
    // Extract geoTag from the related entity
    let geoTagStr = null;
    if (visit.doctor?.geoTag) geoTagStr = visit.doctor.geoTag;
    else if (visit.retailer?.geoTag) geoTagStr = visit.retailer.geoTag;
    else if (visit.hospital?.geoTag) geoTagStr = visit.hospital.geoTag;

    if (geoTagStr && input.lat && input.lng) {
      const [targetLat, targetLng] = geoTagStr.split(',').map(n => parseFloat(n.trim()));
      if (!isNaN(targetLat) && !isNaN(targetLng)) {
        const distance = getDistanceInMeters(input.lat, input.lng, targetLat, targetLng);
        const MAX_ALLOWED_DISTANCE_METERS = 200; // configurable by policy
        if (distance > MAX_ALLOWED_DISTANCE_METERS) {
          throw new Error(`You are too far from the visit location (${Math.round(distance)}m). Please move closer and try again.`);
        }
      }
    }

    return prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.CHECKED_IN,
        checkInTime: new Date(),
        checkInLat: input.lat,
        checkInLng: input.lng,
        checkInAddress: input.address,
        checkInGpsAccuracy: input.gpsAccuracy,
      },
    });
  },

  // ── §9 Prepare ─ CHECKED_IN → PREPARING ────────────────────────────────
  async prepare(id: string, userId: string) {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new Error('Visit not found');
    if (visit.userId !== userId) throw new Error('Access denied');
    if (!['CHECKED_IN', 'PREPARING', 'ENGAGING', 'DETAILING', 'CHECKED_OUT'].includes(visit.status)) {
      throw new Error(`Cannot prepare: visit is currently ${visit.status}. Must be CHECKED_IN or later.`);
    }
    return prisma.visit.update({ where: { id }, data: { status: visit.status === 'CHECKED_IN' ? VisitStatus.PREPARING : visit.status } });
  },

  // ── §11 Engage ─ PREPARING → ENGAGING ────────────────────────────────────
  async engage(id: string, userId: string, data?: { engagement?: string; visitFeedback?: string }) {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new Error('Visit not found');
    if (visit.userId !== userId) throw new Error('Access denied');
    if (!['CHECKED_IN', 'PREPARING', 'ENGAGING', 'DETAILING', 'CHECKED_OUT'].includes(visit.status)) {
      throw new Error(`Cannot engage: visit is currently ${visit.status}. Must be PREPARING, CHECKED_IN, or later.`);
    }
    return prisma.visit.update({ 
      where: { id }, 
      data: { 
        status: ['CHECKED_IN', 'PREPARING'].includes(visit.status) ? VisitStatus.ENGAGING : visit.status,
        ...(data?.engagement && { engagement: data.engagement }),
        ...(data?.visitFeedback && { visitFeedback: data.visitFeedback }),
      } 
    });
  },

  // ── §12 Detail ─ ENGAGING → DETAILING ────────────────────────────────────
  async detail(id: string, userId: string) {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new Error('Visit not found');
    if (visit.userId !== userId) throw new Error('Access denied');
    if (!['CHECKED_IN', 'PREPARING', 'ENGAGING', 'DETAILING', 'CHECKED_OUT'].includes(visit.status)) {
      throw new Error(`Cannot detail: visit is currently ${visit.status}.`);
    }
    return prisma.visit.update({ where: { id }, data: { status: ['CHECKED_IN', 'PREPARING', 'ENGAGING'].includes(visit.status) ? VisitStatus.DETAILING : visit.status } });
  },

  // ── §13 Check-out — active states → REPORT_PENDING (§2.2) ─────────────────
  async checkOut(id: string, userId: string, input: CheckOutInput) {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new Error('Visit not found');
    if (visit.userId !== userId) throw new Error('Access denied');

    const allowedStatuses = ['CHECKED_IN', 'PREPARING', 'ENGAGING', 'DETAILING'];
    if (!allowedStatuses.includes(visit.status)) {
      throw new Error(`Cannot check out: visit is currently ${visit.status}. Must be CHECKED_IN, PREPARING, ENGAGING, or DETAILING.`);
    }

    const checkOutTime = new Date();
    const durationMinutes = visit.checkInTime
      ? Math.round((checkOutTime.getTime() - visit.checkInTime.getTime()) / 60000)
      : undefined;

    return prisma.visit.update({
      where: { id },
      data: {
        // Gap #1 fix (§2.2): transition to REPORT_PENDING (not CHECKED_OUT)
        // so the full defined state machine is honoured.
        status: VisitStatus.REPORT_PENDING,
        checkOutTime,
        checkOutLat: input.lat,
        checkOutLng: input.lng,
        durationMinutes,
      },
    });
  },

  // ── §18 Submit Report — CHECKED_OUT/REPORT_PENDING → REPORTED ────────────
  async submitReport(id: string, userId: string, data: SubmitReportInput) {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new Error('Visit not found');
    if (visit.userId !== userId) throw new Error('Access denied');

    if (!['CHECKED_OUT', 'REPORT_PENDING'].includes(visit.status)) {
      throw new Error(`Cannot submit report: visit is currently ${visit.status}. Must be CHECKED_OUT or REPORT_PENDING.`);
    }

    // Validate mandatory fields (§18)
    if (!data.feedback && !data.engagement) {
      throw new Error('Visit feedback or engagement level is required to submit the report.');
    }
    if (!data.followUpAction) {
      throw new Error('Follow-up action is required to submit the report.');
    }

    return prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.REPORTED,
        reportSubmittedAt: new Date(),
        visitFeedback: data.feedback,
        engagement: data.engagement,
        followUpAction: data.followUpAction,
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
        notes: data.notes,
        objectionsRaised: data.objectionsRaised,
        businessSignal: data.businessSignal || [],
        visitObjective: data.visitObjective || [],
        productsDiscussed: data.productsDiscussed || [],
      },
    });
  },

  // ── §2.2 Next Call — REPORTED → NEXT_CALL ────────────────────────────────
  async nextCall(id: string, userId: string) {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new Error('Visit not found');
    if (visit.userId !== userId) throw new Error('Access denied');

    if (visit.status !== VisitStatus.REPORTED) {
      throw new Error(`Cannot move to next call: visit is currently ${visit.status}. Must be REPORTED.`);
    }

    return prisma.visit.update({
      where: { id },
      data: { status: VisitStatus.NEXT_CALL },
    });
  },

  // ── §23 Mark Missed — PLANNED/NAVIGATING → MISSED ────────────────────────
  async markMissed(id: string, userId: string, input: MarkMissedInput) {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new Error('Visit not found');
    if (visit.userId !== userId) throw new Error('Access denied');

    if (!['PLANNED', 'NAVIGATING'].includes(visit.status)) {
      throw new Error(`Cannot mark as missed: visit is currently ${visit.status}.`);
    }
    if (!input.missedReason) {
      throw new Error('A reason is required when marking a visit as missed.');
    }

    return prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.MISSED,
        missedReason: input.missedReason,
      },
    });
  },

  async approve(id: string, approverId: string) {
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

  // ── §4.1 Today Stats — completed = REPORTED ───────────────────────────────
  async getTodayStats(userId: string) {
    const start = todayStart();
    const end = todayEnd();

    const [planned, reported, reportPending, missed, active, visits] = await Promise.all([
      prisma.visit.count({ where: { userId, plannedDate: { gte: start, lte: end } } }),
      // §4.1: A visit is completed ONLY after report is submitted
      prisma.visit.count({ where: { userId, plannedDate: { gte: start, lte: end }, status: 'REPORTED' } }),
      // §4.1 + Gap #1 fix: checkOut now sets REPORT_PENDING directly.
      // CHECKED_OUT retained in query for backward compatibility with existing records.
      prisma.visit.count({ where: { userId, plannedDate: { gte: start, lte: end }, status: { in: ['CHECKED_OUT', 'REPORT_PENDING'] } } }),
      prisma.visit.count({ where: { userId, plannedDate: { gte: start, lte: end }, status: 'MISSED' } }),
      prisma.visit.count({ where: { userId, plannedDate: { gte: start, lte: end }, status: { in: ACTIVE_VISIT_STATUSES as any } } }),
      prisma.visit.findMany({
        where: { userId, plannedDate: { gte: start, lte: end } },
        select: { visitType: true, status: true },
      }),
    ]);

    const breakdown = {
      doctors:   visits.filter((v) => v.visitType === 'DOCTOR').length,
      hospitals: visits.filter((v) => v.visitType === 'HOSPITAL').length,
      retailers: visits.filter((v) => v.visitType === 'RETAILER').length,
      stockists: visits.filter((v) => ['STOCKIST', 'DISTRIBUTOR'].includes(v.visitType)).length,
      others:    visits.filter((v) => !['DOCTOR', 'HOSPITAL', 'RETAILER', 'STOCKIST', 'DISTRIBUTOR'].includes(v.visitType)).length,
    };

    const remaining = Math.max(0, planned - reported - missed);
    const estimatedTravelKm = planned * 5;
    const estimatedDurationMins = planned * 45;

    return {
      planned,
      completed: reported,    // §4.1: completed = REPORTED only
      reportPending,          // CHECKED_OUT + REPORT_PENDING
      missed,
      active,
      remaining,
      breakdown,
      estimatedTravelKm,
      estimatedDurationMins,
    };
  },
};
