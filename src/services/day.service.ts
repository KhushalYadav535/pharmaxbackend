import prisma from '../config/database';
import { DayStatus, VisitStatus } from '@prisma/client';

export interface StartDayInput {
  lat: number;
  lng: number;
  gpsAccuracy?: number;
  address?: string;
  authMethod?: string;
  deviceId?: string;
}

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

// ── Active-visit statuses (one-active-visit rule) ─────────────────────────
export const ACTIVE_VISIT_STATUSES = [
  'CHECKED_IN',
  'PREPARING',
  'ENGAGING',
  'DETAILING',
  'PAUSED',
] as const;

// ── Day State Engine ──────────────────────────────────────────────────────────

export const dayService = {

  // ── Get current day status for a user ────────────────────────────────────
  async getDayStatus(userId: string) {
    const today = todayStart();
    const attendance = await prisma.attendance.findFirst({
      where: { userId, date: today },
    });

    if (!attendance) {
      return {
        dayStatus: DayStatus.NOT_STARTED as string,
        attendance: null,
      };
    }

    return {
      dayStatus: attendance.dayStatus as string,
      attendance,
    };
  },

  // ── §3.2 Start My Day — validates conditions, creates attendance ────────
  async startDay(userId: string, input: StartDayInput) {
    const today = todayStart();

    // 0. Check employee employment status
    const emp = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, employmentStatus: true, isActive: true },
    });
    if (emp && (!emp.isActive || ['INACTIVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED', 'RETIRED'].includes(emp.employmentStatus || ''))) {
      throw new Error(`Your employment status is ${emp.employmentStatus || 'INACTIVE'}. Field operations are suspended.`);
    }

    // 1. Check no open/incompatible day exists for today
    const existing = await prisma.attendance.findFirst({
      where: { userId, date: today },
    });
    if (existing) {
      throw new Error('You have already started your day today.');
    }

    // 2. Check for active approved leave
    const activeLeave = await prisma.leave.findFirst({
      where: {
        userId,
        approvalStatus: 'APPROVED',
        startDate: { lte: new Date() },
        endDate: { gte: today },
      },
    });
    if (activeLeave) {
      throw new Error('You have an approved leave for today. Day cannot be started.');
    }

    // 3. GPS must be provided (§3.2 rule 5)
    if (input.lat === undefined || input.lng === undefined) {
      throw new Error('GPS location is required to start your day.');
    }

    // 4. Create attendance — locked after this point (§3.3)
    const attendance = await prisma.attendance.create({
      data: {
        userId,
        date: today,
        status: 'PRESENT',
        dayStatus: DayStatus.IN_PROGRESS,
        checkInTime: new Date(),
        checkInLat: input.lat,
        checkInLng: input.lng,
        checkInGpsAccuracy: input.gpsAccuracy,
        authMethod: input.authMethod,
        deviceId: input.deviceId,
        notes: input.address,
      },
    });

    // 5. Write audit/state log
    await prisma.dayStateLog.create({
      data: {
        userId,
        attendanceId: attendance.id,
        fromStatus: DayStatus.NOT_STARTED,
        toStatus: DayStatus.IN_PROGRESS,
        lat: input.lat,
        lng: input.lng,
        deviceId: input.deviceId,
      },
    });

    return attendance;
  },

  // ── §24 Begin Day End Review ──────────────────────────────────────────────
  async beginDayEnd(userId: string) {
    const attendance = await this._requireOpenDay(userId);

    if (attendance.dayStatus !== DayStatus.IN_PROGRESS) {
      throw new Error(`Cannot enter Day End from state: ${attendance.dayStatus}`);
    }

    // Cannot be in an active visit (§27)
    await this._assertNoActiveVisit(userId);

    // Gap #2 fix (§27): Also block if any visit is CHECKED_OUT with unsubmitted report
    const start = todayStart();
    const end = todayEnd();
    const unreportedCount = await prisma.visit.count({
      where: {
        userId,
        status: { in: ['CHECKED_OUT', 'REPORT_PENDING'] },
        plannedDate: { gte: start, lte: end },
      },
    });
    if (unreportedCount > 0) {
      throw new Error(
        `${unreportedCount} visit report(s) are pending submission. Please submit all reports before ending the day.`,
      );
    }

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: { dayStatus: DayStatus.DAY_END_REVIEW },
    });

    await prisma.dayStateLog.create({
      data: {
        userId,
        attendanceId: attendance.id,
        fromStatus: DayStatus.IN_PROGRESS,
        toStatus: DayStatus.DAY_END_REVIEW,
      },
    });

    return updated;
  },

  // ── §26 Validate Close Day — returns blockers & bulk-missed eligibility ───
  async validateCloseDay(userId: string): Promise<{
    canClose: boolean;
    canCloseWithBulkMissed: boolean;
    pendingPlannedCount: number;
    pendingPlannedVisits: Array<{
      id: string;
      visitType: string;
      targetName: string;
      specialty?: string | null;
      city?: string | null;
    }>;
    hasHardBlockers: boolean;
    blockers: string[];
  }> {
    const blockers: string[] = [];
    const hardBlockers: string[] = [];
    const start = todayStart();
    const end = todayEnd();

    // 1. Attendance must exist
    const attendance = await prisma.attendance.findFirst({
      where: { userId, date: start },
    });
    if (!attendance) {
      hardBlockers.push('No attendance record found for today.');
      blockers.push('No attendance record found for today.');
      return {
        canClose: false,
        canCloseWithBulkMissed: false,
        pendingPlannedCount: 0,
        pendingPlannedVisits: [],
        hasHardBlockers: true,
        blockers,
      };
    }

    // 2. Day must be in IN_PROGRESS or DAY_END_REVIEW (not already CLOSED)
    if (attendance.dayStatus === DayStatus.CLOSED) {
      hardBlockers.push('Your day is already closed.');
      blockers.push('Your day is already closed.');
    }

    // 3. No active visit in clinic (CHECKED_IN, ENGAGING, DETAILING, PAUSED) (§27)
    const activeVisit = await prisma.visit.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_VISIT_STATUSES as any },
        plannedDate: { gte: start, lte: end },
      },
    });
    if (activeVisit) {
      hardBlockers.push('You have an active visit in progress. Check out and submit the report first.');
      blockers.push('You have an active visit in progress. Check out and submit the report first.');
    }

    // 4. No CHECKED_OUT / REPORT_PENDING visits (report not submitted)
    const unreportedVisits = await prisma.visit.count({
      where: {
        userId,
        status: { in: ['CHECKED_OUT', 'REPORT_PENDING'] },
        plannedDate: { gte: start, lte: end },
      },
    });
    if (unreportedVisits > 0) {
      hardBlockers.push(`${unreportedVisits} visit report(s) pending. Submit all reports before closing the day.`);
      blockers.push(`${unreportedVisits} visit report(s) pending. Submit all reports before closing the day.`);
    }

    // 5. Query PLANNED/NAVIGATING visits (unvisited calls)
    const incompleteVisits = await prisma.visit.findMany({
      where: {
        userId,
        status: { in: ['PLANNED', 'NAVIGATING'] },
        plannedDate: { gte: start, lte: end },
      },
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true, city: true } },
        retailer: { select: { id: true, name: true, city: true } },
        distributor: { select: { id: true, name: true, city: true } },
        hospital: { select: { id: true, name: true, city: true } },
        stockist: { select: { id: true, name: true, city: true } },
      },
    });

    const pendingPlannedCount = incompleteVisits.length;
    const hasHardBlockers = hardBlockers.length > 0;
    const canCloseWithBulkMissed = !hasHardBlockers && pendingPlannedCount > 0;
    const canCloseDirectly = !hasHardBlockers && pendingPlannedCount === 0;

    // Friendly prompt for unvisited calls
    if (pendingPlannedCount > 0) {
      blockers.push(`${pendingPlannedCount} visit(s) were not completed. You can mark them MISSED in 1 click to close your day.`);
    }

    return {
      canClose: canCloseDirectly || canCloseWithBulkMissed,
      canCloseWithBulkMissed,
      pendingPlannedCount,
      pendingPlannedVisits: incompleteVisits.map((v: any) => {
        let targetName = 'Commercial Partner';
        if (v.doctor) targetName = `Dr. ${v.doctor.firstName} ${v.doctor.lastName}`;
        else if (v.retailer) targetName = v.retailer.name;
        else if (v.distributor) targetName = v.distributor.name;
        else if (v.hospital) targetName = v.hospital.name;
        else if (v.stockist) targetName = v.stockist.name;

        return {
          id: v.id,
          visitType: v.visitType,
          targetName,
          specialty: v.doctor?.specialty || null,
          city: v.doctor?.city || v.retailer?.city || v.distributor?.city || null,
        };
      }),
      hasHardBlockers,
      blockers,
    };
  },

  // ── §28 Close Day — irreversible ──────────────────────────────────────────
  async closeDay(userId: string, input?: {
    lat?: number;
    lng?: number;
    address?: string;
    bulkMissedReason?: string;
    carryForwardMissedToTomorrow?: boolean;
  }) {
    const check = await this.validateCloseDay(userId);
    if (check.hasHardBlockers) {
      throw new Error(`Cannot close day: ${check.blockers.filter(b => !b.includes('1 click')).join(' | ')}`);
    }

    const start = todayStart();
    const end = todayEnd();

    // If there are unvisited PLANNED/NAVIGATING calls:
    if (check.pendingPlannedCount > 0) {
      if (!input?.bulkMissedReason || !input.bulkMissedReason.trim()) {
        throw new Error(`Cannot close day: ${check.pendingPlannedCount} planned visit(s) remain incomplete. Please select a reason to mark them missed.`);
      }

      const reason = input.bulkMissedReason.trim();

      // Retrieve planned visits to carry forward if requested
      const pendingVisits = await prisma.visit.findMany({
        where: {
          userId,
          status: { in: ['PLANNED', 'NAVIGATING'] },
          plannedDate: { gte: start, lte: end },
        },
      });

      // Update remaining planned calls to MISSED
      await prisma.visit.updateMany({
        where: {
          userId,
          status: { in: ['PLANNED', 'NAVIGATING'] },
          plannedDate: { gte: start, lte: end },
        },
        data: {
          status: VisitStatus.MISSED,
          missedReason: reason,
          remarks: `Bulk marked MISSED on day close: ${reason}`,
        },
      });

      // Optional carry forward to tomorrow
      if (input.carryForwardMissedToTomorrow) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 30, 0, 0);

        for (const pv of pendingVisits) {
          try {
            await prisma.visit.create({
              data: {
                userId,
                visitType: pv.visitType,
                status: VisitStatus.PLANNED,
                plannedDate: tomorrow,
                doctorId: pv.doctorId,
                hospitalId: pv.hospitalId,
                retailerId: pv.retailerId,
                distributorId: pv.distributorId,
                stockistId: pv.stockistId,
                remarks: `Carried forward from yesterday (Missed: ${reason})`,
                isUnplanned: false,
              },
            });
          } catch (createErr) {
            console.warn('Could not carry forward visit:', pv.id, createErr);
          }
        }
      }
    }

    const attendance = await this._requireOpenDay(userId);
    const now = new Date();
    const durationMinutes = attendance.checkInTime
      ? Math.max(0, Math.round((now.getTime() - attendance.checkInTime.getTime()) / (1000 * 60)))
      : 0;

    // Check minimum duration: if under 240 mins (4 hrs), mark HALF_DAY, else PRESENT
    const finalStatus = durationMinutes < 240 ? 'HALF_DAY' : 'PRESENT';

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        dayStatus: DayStatus.CLOSED,
        checkOutTime: now,
        checkOutLat: input?.lat ?? null,
        checkOutLng: input?.lng ?? null,
        checkOutAddress: input?.address ?? null,
        durationMinutes,
        status: finalStatus as any,
      },
    });

    await prisma.dayStateLog.create({
      data: {
        userId,
        attendanceId: attendance.id,
        fromStatus: attendance.dayStatus as DayStatus,
        toStatus: DayStatus.CLOSED,
        lat: input?.lat ?? null,
        lng: input?.lng ?? null,
      },
    });

    // Close any active user sessions for this user so app time stops accumulating
    try {
      const activeSessions = await prisma.userSession.findMany({
        where: { userId, status: 'ACTIVE' },
      });
      for (const s of activeSessions) {
        const sessionMins = Math.max(0, Math.round((now.getTime() - s.loginAt.getTime()) / (1000 * 60)));
        await prisma.userSession.update({
          where: { id: s.id },
          data: {
            status: 'LOGGED_OUT',
            logoutAt: now,
            durationMinutes: sessionMins,
            logoutReason: 'DAY_CLOSED',
          },
        });
      }
    } catch (sessionErr) {
      console.warn('Could not auto-close session on day close:', sessionErr);
    }

    return updated;
  },

  // ── Private helpers ───────────────────────────────────────────────────────

  async _requireOpenDay(userId: string) {
    const today = todayStart();
    const attendance = await prisma.attendance.findFirst({
      where: { userId, date: today },
    });
    if (!attendance) {
      throw new Error('Day has not been started yet. Please start your day first.');
    }
    if (attendance.dayStatus === DayStatus.CLOSED) {
      throw new Error('Your day is already closed.');
    }
    return attendance;
  },

  async _assertNoActiveVisit(userId: string) {
    const today = todayStart();
    const end = todayEnd();
    const active = await prisma.visit.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_VISIT_STATUSES as any },
        plannedDate: { gte: today, lte: end },
      },
    });
    if (active) {
      throw new Error('An active visit is in progress. Complete or check out from the current visit first.');
    }
  },
};
