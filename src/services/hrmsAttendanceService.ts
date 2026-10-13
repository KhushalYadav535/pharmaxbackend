import prisma from '../config/database';
import { DayStatus, AttendanceStatus } from '@prisma/client';

export interface AttendanceFilter {
  fromDate?: string;
  toDate?: string;
  departmentId?: string;
  divisionId?: string;
  userId?: string;
  managerId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface RegularizationRequestInput {
  attendanceId?: string;
  attendanceDate: string;
  regularizationType: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
}

export const hrmsAttendanceService = {
  // ── 1. Attendance Register for Admin / Managers ───────────────────────────
  async getAttendanceRegister(filters: AttendanceFilter) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 30));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.fromDate || filters.toDate) {
      where.date = {};
      if (filters.fromDate) where.date.gte = new Date(filters.fromDate);
      if (filters.toDate) {
        const to = new Date(filters.toDate);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    // Filter by user's org attributes
    const userWhere: any = {};
    if (filters.departmentId) userWhere.departmentId = filters.departmentId;
    if (filters.divisionId) userWhere.divisionId = filters.divisionId;
    if (filters.managerId) userWhere.managerId = filters.managerId;

    if (Object.keys(userWhere).length > 0) {
      where.user = userWhere;
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { checkInTime: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              role: true,
              phone: true,
              departmentRel: { select: { id: true, name: true, code: true } },
              divisionRel: { select: { id: true, name: true, code: true } },
              designationRel: { select: { id: true, name: true, code: true } },
              gradeBandRel: { select: { id: true, name: true, code: true } },
              manager: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          regularization: {
            select: {
              id: true,
              regularizationType: true,
              reason: true,
              status: true,
              managerRemarks: true,
            },
          },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    // Annotate exceptions per record
    const annotatedRecords = records.map((r) => {
      const exceptions: string[] = [];
      if (r.checkInTime) {
        const hour = r.checkInTime.getHours();
        const min = r.checkInTime.getMinutes();
        // Standard start is 09:30 + 30m grace = 10:00 AM
        if (hour > 10 || (hour === 10 && min > 0)) {
          exceptions.push('Late Start');
        }
      }
      if (r.dayStatus === DayStatus.CLOSED && r.checkOutTime) {
        const hour = r.checkOutTime.getHours();
        if (hour < 17) {
          exceptions.push('Early Close');
        }
      }
      if (r.dayStatus === DayStatus.IN_PROGRESS) {
        const msElapsed = Date.now() - new Date(r.date).getTime();
        if (msElapsed > 24 * 60 * 60 * 1000) {
          exceptions.push('No Close Day (Overnight Open)');
        }
      }
      if (r.durationMinutes && r.durationMinutes < 240) {
        exceptions.push('Short Duration (<4h)');
      }

      return {
        ...r,
        exceptions,
      };
    });

    return {
      records: annotatedRecords,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  // ── 2. Attendance Exceptions Dashboard ───────────────────────────────────
  async getAttendanceExceptions(filters: { fromDate?: string; toDate?: string; departmentId?: string; divisionId?: string }) {
    const from = filters.fromDate ? new Date(filters.fromDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = filters.toDate ? new Date(filters.toDate) : new Date();
    to.setHours(23, 59, 59, 999);

    const attendances = await prisma.attendance.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(filters.departmentId ? { user: { departmentId: filters.departmentId } } : {}),
        ...(filters.divisionId ? { user: { divisionId: filters.divisionId } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            role: true,
            departmentRel: { select: { name: true } },
            designationRel: { select: { name: true } },
            manager: { select: { firstName: true, lastName: true } },
          },
        },
        regularization: true,
      },
      orderBy: { date: 'desc' },
    });

    const exceptions: Array<{
      attendanceId: string;
      userId: string;
      employeeName: string;
      employeeCode?: string;
      date: Date;
      exceptionType: string;
      details: string;
      checkInTime?: Date | null;
      checkOutTime?: Date | null;
      durationMinutes?: number | null;
      isRegularized: boolean;
      regularizationStatus?: string;
    }> = [];

    for (const r of attendances) {
      if (r.checkInTime) {
        const hour = r.checkInTime.getHours();
        const min = r.checkInTime.getMinutes();
        if (hour > 10 || (hour === 10 && min > 0)) {
          exceptions.push({
            attendanceId: r.id,
            userId: r.userId,
            employeeName: `${r.user.firstName} ${r.user.lastName}`,
            employeeCode: r.user.employeeId || undefined,
            date: r.date,
            exceptionType: 'LATE_START',
            details: `Checked in late at ${r.checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            checkInTime: r.checkInTime,
            checkOutTime: r.checkOutTime,
            durationMinutes: r.durationMinutes,
            isRegularized: r.isRegularized,
            regularizationStatus: r.regularization?.status,
          });
        }
      }

      if (r.dayStatus === DayStatus.IN_PROGRESS) {
        const msElapsed = Date.now() - new Date(r.date).getTime();
        if (msElapsed > 20 * 60 * 60 * 1000) {
          exceptions.push({
            attendanceId: r.id,
            userId: r.userId,
            employeeName: `${r.user.firstName} ${r.user.lastName}`,
            employeeCode: r.user.employeeId || undefined,
            date: r.date,
            exceptionType: 'NO_CLOSE_DAY',
            details: 'Field day started but never closed before midnight',
            checkInTime: r.checkInTime,
            checkOutTime: null,
            durationMinutes: r.durationMinutes,
            isRegularized: r.isRegularized,
            regularizationStatus: r.regularization?.status,
          });
        }
      }

      if (r.durationMinutes !== null && r.durationMinutes !== undefined && r.durationMinutes < 240 && r.dayStatus === DayStatus.CLOSED) {
        exceptions.push({
          attendanceId: r.id,
          userId: r.userId,
          employeeName: `${r.user.firstName} ${r.user.lastName}`,
          employeeCode: r.user.employeeId || undefined,
          date: r.date,
          exceptionType: 'SHORT_DURATION',
          details: `Total working time was only ${Math.floor(r.durationMinutes / 60)}h ${r.durationMinutes % 60}m (<4 hours)`,
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          durationMinutes: r.durationMinutes,
          isRegularized: r.isRegularized,
          regularizationStatus: r.regularization?.status,
        });
      }
    }

    return {
      totalExceptions: exceptions.length,
      exceptions,
    };
  },

  // ── 3. Monthly Attendance Calendar / Summary for Employee ─────────────────
  async getEmployeeAttendanceSummary(userId: string, yearMonth?: string) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed

    if (yearMonth) {
      const parts = yearMonth.split('-');
      if (parts.length === 2) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
      }
    }

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const [attendances, holidays, leaves] = await Promise.all([
      prisma.attendance.findMany({
        where: { userId, date: { gte: startDate, lte: endDate } },
        include: { regularization: true },
        orderBy: { date: 'asc' },
      }),
      prisma.holiday.findMany({
        where: { date: { gte: startDate, lte: endDate }, status: true },
      }),
      prisma.leave.findMany({
        where: {
          userId,
          approvalStatus: 'APPROVED',
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      }),
    ]);

    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let totalWorkMinutes = 0;

    for (const a of attendances) {
      if (a.status === 'PRESENT') presentDays++;
      else if (a.status === 'HALF_DAY') halfDays++;
      if (a.durationMinutes) totalWorkMinutes += a.durationMinutes;
    }

    for (const l of leaves) {
      leaveDays += l.totalDays;
    }

    return {
      month: `${year}-${String(month + 1).padStart(2, '0')}`,
      stats: {
        presentDays,
        halfDays,
        leaveDays,
        totalWorkHours: +(totalWorkMinutes / 60).toFixed(1),
        averageDailyHours: presentDays > 0 ? +(totalWorkMinutes / 60 / (presentDays + halfDays * 0.5)).toFixed(1) : 0,
      },
      attendances,
      holidays,
      leaves,
    };
  },

  // ── 4. Create Regularization Request ───────────────────────────────────────
  async createRegularization(userId: string, input: RegularizationRequestInput) {
    const attDate = new Date(input.attendanceDate);
    attDate.setHours(0, 0, 0, 0);

    // Prevent duplicate pending request for the same date
    const existing = await prisma.attendanceRegularization.findFirst({
      where: {
        userId,
        attendanceDate: attDate,
        status: 'PENDING',
      },
    });

    if (existing) {
      throw new Error('A pending regularization request already exists for this date.');
    }

    const parseTime = (val?: string | Date | null) => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      const str = String(val).trim();
      if (str.includes('T') || str.includes('-')) {
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
      }
      const parts = str.split(':').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const d = new Date(attDate);
        d.setHours(parts[0], parts[1], 0, 0);
        return d;
      }
      return null;
    };

    const regularization = await prisma.attendanceRegularization.create({
      data: {
        userId,
        attendanceId: input.attendanceId || null,
        attendanceDate: attDate,
        regularizationType: input.regularizationType,
        requestedCheckIn: parseTime(input.requestedCheckIn),
        requestedCheckOut: parseTime(input.requestedCheckOut),
        reason: input.reason,
        status: 'PENDING',
      },
    });

    return regularization;
  },

  // ── 5. List Regularizations ────────────────────────────────────────────────
  async listRegularizations(filters: {
    userId?: string;
    managerId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 30));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      where.attendanceDate = {};
      if (filters.fromDate) where.attendanceDate.gte = new Date(filters.fromDate);
      if (filters.toDate) {
        const to = new Date(filters.toDate);
        to.setHours(23, 59, 59, 999);
        where.attendanceDate.lte = to;
      }
    }

    // If manager, filter by their team reports
    if (filters.managerId) {
      where.user = { managerId: filters.managerId };
    }

    const [records, total] = await Promise.all([
      prisma.attendanceRegularization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              role: true,
              departmentRel: { select: { name: true } },
              designationRel: { select: { name: true } },
              manager: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          hrApprovedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.attendanceRegularization.count({ where }),
    ]);

    return {
      records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  // ── 6. Review Regularization (Approve / Reject) ─────────────────────────────
  async reviewRegularization(
    regularizationId: string,
    reviewerId: string,
    reviewerRole: string,
    action: 'APPROVE' | 'REJECT',
    remarks?: string
  ) {
    const reg = await prisma.attendanceRegularization.findUnique({
      where: { id: regularizationId },
      include: { user: true },
    });

    if (!reg) {
      throw new Error('Regularization request not found.');
    }

    if (reg.status !== 'PENDING' && reg.status !== 'MANAGER_APPROVED') {
      throw new Error(`Cannot review request in ${reg.status} status.`);
    }

    // Check approval workflow setting
    const workflowSetting = await prisma.hRMSSetting.findUnique({
      where: { key: 'regularization_approval_workflow' },
    });
    const isTwoLevel = workflowSetting?.value === 'TWO_LEVEL';
    const isSuperAdminOrHR = ['SUPER_ADMIN', 'SALES_ADMIN'].includes(reviewerRole);

    let newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    // If TWO_LEVEL and reviewed by manager (not HR/Super Admin), mark as MANAGER_APPROVED
    if (action === 'APPROVE' && isTwoLevel && !isSuperAdminOrHR && reg.status === 'PENDING') {
      newStatus = 'MANAGER_APPROVED';
    }

    const updateData: any = {
      status: newStatus,
      managerRemarks: remarks || null,
    };

    if (newStatus === 'MANAGER_APPROVED' || (newStatus === 'APPROVED' && !reg.approvedById)) {
      updateData.approvedById = reviewerId;
      updateData.approvedAt = new Date();
    }

    if (isSuperAdminOrHR && (newStatus === 'APPROVED' || newStatus === 'REJECTED')) {
      updateData.hrApprovedById = reviewerId;
      updateData.hrApprovedAt = new Date();
    }

    const updated = await prisma.attendanceRegularization.update({
      where: { id: regularizationId },
      data: updateData,
    });

    // If final approval, update or create Attendance record!
    if (newStatus === 'APPROVED') {
      const attDate = new Date(reg.attendanceDate);
      attDate.setHours(0, 0, 0, 0);

      const checkInTime = reg.requestedCheckIn || new Date(attDate.getTime() + 9.5 * 60 * 60 * 1000); // 09:30 AM
      const checkOutTime = reg.requestedCheckOut || new Date(attDate.getTime() + 18 * 60 * 60 * 1000); // 18:00 PM
      const durationMinutes = Math.max(0, Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60)));

      // Upsert attendance
      await prisma.attendance.upsert({
        where: {
          userId_date: {
            userId: reg.userId,
            date: attDate,
          },
        },
        update: {
          status: 'PRESENT',
          dayStatus: DayStatus.CLOSED,
          checkInTime,
          checkOutTime,
          durationMinutes,
          isRegularized: true,
          regularizationId: reg.id,
          notes: `Regularized: ${reg.reason}`,
        },
        create: {
          userId: reg.userId,
          date: attDate,
          status: 'PRESENT',
          dayStatus: DayStatus.CLOSED,
          checkInTime,
          checkOutTime,
          durationMinutes,
          isRegularized: true,
          regularizationId: reg.id,
          notes: `Regularized: ${reg.reason}`,
        },
      });
    }

    return updated;
  },
};
