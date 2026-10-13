import prisma from '../config/database';
import { ApprovalStatus } from '@prisma/client';

export interface ApplyLeaveInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  halfDaySession?: string;
  reason?: string;
  supportingDocUrl?: string;
}

export interface LeaveFilter {
  userId?: string;
  managerId?: string;
  status?: string;
  leaveTypeId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export const hrmsLeaveService = {
  // ── 1. Leave Types ────────────────────────────────────────────────────────
  async listLeaveTypes() {
    return prisma.leaveType.findMany({
      orderBy: { createdAt: 'asc' },
    });
  },

  async createLeaveType(data: {
    name: string;
    code: string;
    daysAllowedPerYear: number;
    carryForwardLimit?: number;
    isPaid?: boolean;
    requiresDocument?: boolean;
    minNoticeDays?: number;
    maxConsecutiveDays?: number;
    description?: string;
  }) {
    return prisma.leaveType.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        daysAllowedPerYear: data.daysAllowedPerYear,
        carryForwardLimit: data.carryForwardLimit || 0,
        isPaid: data.isPaid !== undefined ? data.isPaid : true,
        requiresDocument: data.requiresDocument || false,
        minNoticeDays: data.minNoticeDays || 0,
        maxConsecutiveDays: data.maxConsecutiveDays || 15,
        description: data.description,
      },
    });
  },

  async updateLeaveType(id: string, data: Partial<{
    name: string;
    daysAllowedPerYear: number;
    carryForwardLimit: number;
    isPaid: boolean;
    requiresDocument: boolean;
    minNoticeDays: number;
    maxConsecutiveDays: number;
    description: string;
    status: boolean;
  }>) {
    return prisma.leaveType.update({
      where: { id },
      data,
    });
  },

  // ── 2. Leave Balances for an Employee ─────────────────────────────────────
  async getEmployeeLeaveBalances(userId: string, year?: number) {
    const yr = year || new Date().getFullYear();

    // Ensure balances exist for all active leave types
    const activeTypes = await prisma.leaveType.findMany({ where: { status: true } });
    for (const lt of activeTypes) {
      const existing = await prisma.leaveBalance.findUnique({
        where: {
          unique_user_leave_year: {
            userId,
            leaveTypeId: lt.id,
            year: yr,
          },
        },
      });

      if (!existing) {
        await prisma.leaveBalance.create({
          data: {
            userId,
            leaveTypeId: lt.id,
            year: yr,
            openingBalance: lt.daysAllowedPerYear,
            closingBalance: lt.daysAllowedPerYear,
          },
        });
      }
    }

    return prisma.leaveBalance.findMany({
      where: { userId, year: yr },
      include: {
        leaveType: true,
      },
      orderBy: { leaveType: { code: 'asc' } },
    });
  },

  // ── 3. Apply Leave ────────────────────────────────────────────────────────
  async applyLeave(userId: string, input: ApplyLeaveInput) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      throw new Error('Start date cannot be after end date.');
    }

    // Edge Case: Prevent overlapping active/pending leave applications
    const overlapping = await prisma.leave.findFirst({
      where: {
        userId,
        approvalStatus: { in: [ApprovalStatus.PENDING, ApprovalStatus.APPROVED] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlapping) {
      throw new Error('An active leave application already exists for the selected date range.');
    }

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: input.leaveTypeId },
    });
    if (!leaveType) {
      throw new Error('Invalid leave type selected.');
    }

    // Calculate total days
    let totalDays = 1.0;
    if (input.isHalfDay) {
      totalDays = 0.5;
    } else {
      const diffMs = end.getTime() - start.getTime();
      totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    const year = start.getFullYear();

    // Check balance
    let balance = await prisma.leaveBalance.findUnique({
      where: {
        unique_user_leave_year: {
          userId,
          leaveTypeId: leaveType.id,
          year,
        },
      },
    });

    if (!balance) {
      balance = await prisma.leaveBalance.create({
        data: {
          userId,
          leaveTypeId: leaveType.id,
          year,
          openingBalance: leaveType.daysAllowedPerYear,
          closingBalance: leaveType.daysAllowedPerYear,
        },
      });
    }

    const available = balance.closingBalance - balance.pending;
    if (leaveType.code !== 'LWP' && available < totalDays) {
      throw new Error(
        `Insufficient leave balance. You have ${available} days available, but requested ${totalDays} days.`
      );
    }

    // Hold pending balance
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        pending: balance.pending + totalDays,
      },
    });

    // Create Leave application
    const leave = await prisma.leave.create({
      data: {
        userId,
        leaveType: leaveType.name,
        leaveTypeId: leaveType.id,
        startDate: start,
        endDate: end,
        isHalfDay: input.isHalfDay || false,
        halfDaySession: input.halfDaySession || null,
        totalDays,
        reason: input.reason || null,
        supportingDocUrl: input.supportingDocUrl || null,
        approvalStatus: ApprovalStatus.PENDING,
      },
      include: {
        leaveTypeRel: true,
      },
    });

    return leave;
  },

  // ── 4. List Leaves ────────────────────────────────────────────────────────
  async listLeaves(filters: LeaveFilter) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 30));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.approvalStatus = filters.status;
    if (filters.leaveTypeId) where.leaveTypeId = filters.leaveTypeId;

    if (filters.fromDate || filters.toDate) {
      where.startDate = {};
      if (filters.fromDate) where.startDate.gte = new Date(filters.fromDate);
      if (filters.toDate) {
        const to = new Date(filters.toDate);
        to.setHours(23, 59, 59, 999);
        where.startDate.lte = to;
      }
    }

    if (filters.managerId) {
      where.user = { managerId: filters.managerId };
    }

    const [records, total] = await Promise.all([
      prisma.leave.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
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
          leaveTypeRel: true,
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          hrApprovedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.leave.count({ where }),
    ]);

    return {
      records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  // ── 5. Review Leave (Approve / Reject) ─────────────────────────────────────
  async reviewLeave(
    leaveId: string,
    reviewerId: string,
    reviewerRole: string,
    action: 'APPROVE' | 'REJECT',
    remarks?: string
  ) {
    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: { leaveTypeRel: true },
    });

    if (!leave) {
      throw new Error('Leave application not found.');
    }

    if (leave.approvalStatus !== 'PENDING' && leave.approvalStatus !== 'MANAGER_APPROVED' as any) {
      throw new Error(`Cannot review leave in ${leave.approvalStatus} status.`);
    }

    // Check approval workflow setting
    const workflowSetting = await prisma.hRMSSetting.findUnique({
      where: { key: 'leave_approval_workflow' },
    });
    const isTwoLevel = workflowSetting?.value === 'TWO_LEVEL';
    const isSuperAdminOrHR = ['SUPER_ADMIN', 'SALES_ADMIN'].includes(reviewerRole);

    let newStatus = action === 'APPROVE' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

    // If TWO_LEVEL and reviewed by manager (not HR/Super Admin), mark MANAGER_APPROVED
    if (action === 'APPROVE' && isTwoLevel && !isSuperAdminOrHR && leave.approvalStatus === 'PENDING') {
      newStatus = 'MANAGER_APPROVED' as any;
    }

    const updateData: any = {
      approvalStatus: newStatus,
      managerRemarks: remarks || null,
    };

    if (newStatus === ('MANAGER_APPROVED' as any) || (newStatus === ApprovalStatus.APPROVED && !leave.approvedById)) {
      updateData.approvedById = reviewerId;
      updateData.approvedAt = new Date();
    }

    if (isSuperAdminOrHR && (newStatus === ApprovalStatus.APPROVED || newStatus === ApprovalStatus.REJECTED)) {
      updateData.hrApprovedById = reviewerId;
      updateData.hrApprovalStatus = newStatus;
    }

    if (newStatus === ApprovalStatus.REJECTED) {
      updateData.rejectionReason = remarks || 'Leave application rejected';
    }

    const updated = await prisma.leave.update({
      where: { id: leaveId },
      data: updateData,
    });

    // Update Leave Balance
    if (leave.leaveTypeId) {
      const year = new Date(leave.startDate).getFullYear();
      const balance = await prisma.leaveBalance.findUnique({
        where: {
          unique_user_leave_year: {
            userId: leave.userId,
            leaveTypeId: leave.leaveTypeId,
            year,
          },
        },
      });

      if (balance) {
        if (newStatus === ApprovalStatus.APPROVED) {
          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: {
              used: balance.used + leave.totalDays,
              pending: Math.max(0, balance.pending - leave.totalDays),
              closingBalance: Math.max(0, balance.closingBalance - leave.totalDays),
            },
          });
        } else if (newStatus === ApprovalStatus.REJECTED) {
          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pending: Math.max(0, balance.pending - leave.totalDays),
            },
          });
        }
      }
    }

    return updated;
  },

  // ── 6. Cancel Leave ───────────────────────────────────────────────────────
  async cancelLeave(leaveId: string, userId: string) {
    const leave = await prisma.leave.findUnique({ where: { id: leaveId } });
    if (!leave) throw new Error('Leave application not found.');
    if (leave.userId !== userId) throw new Error('You can only cancel your own leaves.');
    if (leave.approvalStatus === ApprovalStatus.APPROVED) {
      throw new Error('Approved leave cannot be cancelled directly. Please contact HR admin.');
    }

    const updated = await prisma.leave.update({
      where: { id: leaveId },
      data: { approvalStatus: ApprovalStatus.CANCELLED },
    });

    // Release pending balance
    if (leave.leaveTypeId) {
      const year = new Date(leave.startDate).getFullYear();
      const balance = await prisma.leaveBalance.findUnique({
        where: {
          unique_user_leave_year: {
            userId: leave.userId,
            leaveTypeId: leave.leaveTypeId,
            year,
          },
        },
      });
      if (balance) {
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: Math.max(0, balance.pending - leave.totalDays),
          },
        });
      }
    }

    return updated;
  },

  // ── 7. Holiday Calendar ───────────────────────────────────────────────────
  async listHolidays(filters?: { year?: number; divisionId?: string; state?: string }) {
    const year = filters?.year || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    const where: any = {
      date: { gte: start, lte: end },
      status: true,
    };

    if (filters?.divisionId) where.divisionId = filters.divisionId;
    if (filters?.state) where.state = filters.state;

    return prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
      include: { division: { select: { id: true, name: true, code: true } } },
    });
  },

  async createHoliday(data: {
    name: string;
    date: string;
    holidayType?: string;
    state?: string;
    divisionId?: string;
    isOptional?: boolean;
    description?: string;
  }) {
    return prisma.holiday.create({
      data: {
        name: data.name,
        date: new Date(data.date),
        holidayType: data.holidayType || 'NATIONAL',
        state: data.state || null,
        divisionId: data.divisionId || null,
        isOptional: data.isOptional || false,
        description: data.description || null,
      },
    });
  },

  async updateHoliday(id: string, data: Partial<{
    name: string;
    date: string;
    holidayType: string;
    state: string;
    divisionId: string;
    isOptional: boolean;
    description: string;
    status: boolean;
  }>) {
    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    return prisma.holiday.update({
      where: { id },
      data: updateData,
    });
  },

  async deleteHoliday(id: string) {
    return prisma.holiday.delete({ where: { id } });
  },
};
