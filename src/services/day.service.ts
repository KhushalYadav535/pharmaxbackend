import prisma from '../config/database';
import { DayStatus } from '@prisma/client';

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

  // ── §3.2 Start My Day — validates 8 conditions, creates attendance ────────
  async startDay(userId: string, input: StartDayInput) {
    const today = todayStart();

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

  // ── §26 Validate Close Day — returns blockers list ────────────────────────
  async validateCloseDay(userId: string): Promise<{ canClose: boolean; blockers: string[] }> {
    const blockers: string[] = [];
    const start = todayStart();
    const end = todayEnd();

    // 1. Attendance must exist
    const attendance = await prisma.attendance.findFirst({
      where: { userId, date: start },
    });
    if (!attendance) {
      blockers.push('No attendance record found for today.');
      return { canClose: false, blockers };
    }

    // 2. No active visit (§27)
    const activeVisit = await prisma.visit.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_VISIT_STATUSES as any },
        plannedDate: { gte: start, lte: end },
      },
    });
    if (activeVisit) {
      blockers.push('You have an active visit in progress. Check out and submit the report first.');
    }

    // 3. No CHECKED_OUT / REPORT_PENDING visits (report not submitted)
    const unreportedVisits = await prisma.visit.count({
      where: {
        userId,
        status: { in: ['CHECKED_OUT', 'REPORT_PENDING'] },
        plannedDate: { gte: start, lte: end },
      },
    });
    if (unreportedVisits > 0) {
      blockers.push(`${unreportedVisits} visit report(s) pending. Submit all reports before closing the day.`);
    }

    // 4. No PLANNED/NAVIGATING visits (must be completed, cancelled, or marked missed)
    const incompleteVisits = await prisma.visit.count({
      where: {
        userId,
        status: { in: ['PLANNED', 'NAVIGATING'] },
        plannedDate: { gte: start, lte: end },
      },
    });
    if (incompleteVisits > 0) {
      blockers.push(`${incompleteVisits} visit(s) are still incomplete. Please mark them as MISSED with a reason if they were not done.`);
    }

    // 4. Day must be in IN_PROGRESS or DAY_END_REVIEW (not already CLOSED)
    if (attendance.dayStatus === DayStatus.CLOSED) {
      blockers.push('Your day is already closed.');
    }

    return {
      canClose: blockers.length === 0,
      blockers,
    };
  },

  // ── §28 Close Day — irreversible ──────────────────────────────────────────
  async closeDay(userId: string) {
    const { canClose, blockers } = await this.validateCloseDay(userId);
    if (!canClose) {
      throw new Error(`Cannot close day: ${blockers.join(' | ')}`);
    }

    const attendance = await this._requireOpenDay(userId);

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        dayStatus: DayStatus.CLOSED,
        checkOutTime: new Date(),
      },
    });

    await prisma.dayStateLog.create({
      data: {
        userId,
        attendanceId: attendance.id,
        fromStatus: attendance.dayStatus as DayStatus,
        toStatus: DayStatus.CLOSED,
      },
    });

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
