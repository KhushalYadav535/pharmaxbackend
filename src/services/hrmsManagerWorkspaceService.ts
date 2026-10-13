import prisma from '../config/database';

export const hrmsManagerWorkspaceService = {
  /**
   * Helper to get list of user IDs belonging to a manager's team.
   * If managerId is admin or superadmin, returns all active field employees if team is empty.
   */
  async getTeamUserIds(managerId: string): Promise<string[]> {
    // 1. Check direct reports
    const directReports = await prisma.user.findMany({
      where: { managerId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    let ids = directReports.map((u) => u.id);

    // 2. Also check EmployeeAssignment where managerId matches
    const assigned = await prisma.employeeAssignment.findMany({
      where: { managerId, isCurrent: true },
      select: { userId: true },
    });
    for (const a of assigned) {
      if (!ids.includes(a.userId)) ids.push(a.userId);
    }

    // 3. Fallback for testing / admin viewing: if user is ADMIN or SUPERADMIN, return all field personnel
    if (ids.length === 0) {
      const user = await prisma.user.findUnique({
        where: { id: managerId },
        select: { role: true },
      });
      if (user && ['SUPER_ADMIN', 'SALES_ADMIN', 'ASM', 'RSM', 'ZM', 'NSM'].includes(user.role)) {
        const allField = await prisma.user.findMany({
          where: { role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP', 'ASM'] }, isActive: true, deletedAt: null },
          select: { id: true },
        });
        ids = allField.map((u) => u.id);
      }
    }

    return ids;
  },

  async getTeamSnapshot(managerId: string, dateStr?: string) {
    const teamUserIds = await this.getTeamUserIds(managerId);

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    // Fetch team member records
    const members = await prisma.user.findMany({
      where: { id: { in: teamUserIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        role: true,
        phone: true,
        designation: true,
        department: true,
        hq: { select: { id: true, name: true } },
      },
    });

    // Fetch attendances for today
    const attendances = await prisma.attendance.findMany({
      where: {
        userId: { in: teamUserIds },
        date: { gte: startOfDay, lte: endOfDay },
      },
    });
    const attMap = new Map<string, any>();
    attendances.forEach((a) => attMap.set(a.userId, a));

    // Fetch today's visits
    const visits = await prisma.visit.findMany({
      where: {
        userId: { in: teamUserIds },
        plannedDate: { gte: startOfDay, lte: endOfDay },
      },
      select: { userId: true, status: true },
    });

    const visitCountMap = new Map<string, { planned: number; completed: number }>();
    members.forEach((m) => visitCountMap.set(m.id, { planned: 0, completed: 0 }));
    visits.forEach((v) => {
      const curr = visitCountMap.get(v.userId) || { planned: 0, completed: 0 };
      curr.planned += 1;
      if (v.status === 'COMPLETED' || (v.status as string) === 'REPORTED') {
        curr.completed += 1;
      }
      visitCountMap.set(v.userId, curr);
    });

    // Fetch pending count across categories for this team
    const pendingLeavesCount = await prisma.leave.count({
      where: {
        userId: { in: teamUserIds },
        approvalStatus: 'PENDING',
      },
    });

    const pendingRegularizationsCount = await prisma.attendanceRegularization.count({
      where: {
        userId: { in: teamUserIds },
        status: 'PENDING',
      },
    });

    const pendingExpensesCount = await prisma.expense.count({
      where: {
        userId: { in: teamUserIds },
        approvalStatus: 'PENDING',
      },
    });

    // Assemble member statuses
    let presentCount = 0;
    let absentCount = 0;
    let onLeaveCount = 0;
    let fieldActiveCount = 0;
    let notStartedCount = 0;

    const roster = members.map((m) => {
      const att = attMap.get(m.id);
      const vStats = visitCountMap.get(m.id) || { planned: 0, completed: 0 };

      let status = 'NOT_STARTED';
      let dayStatus = 'NOT_STARTED';

      if (att) {
        status = att.status;
        dayStatus = att.dayStatus;
        if (att.status === 'PRESENT') {
          presentCount++;
          if (att.dayStatus === 'IN_PROGRESS') {
            fieldActiveCount++;
          }
        } else if (att.status === 'ON_LEAVE') {
          onLeaveCount++;
        } else if (att.status === 'ABSENT') {
          absentCount++;
        }
      } else {
        notStartedCount++;
      }

      return {
        ...m,
        attendance: att
          ? {
              status: att.status,
              dayStatus: att.dayStatus,
              checkInTime: att.checkInTime,
              checkOutTime: att.checkOutTime,
              durationMinutes: att.durationMinutes,
              isRegularized: att.isRegularized,
            }
          : null,
        visits: vStats,
      };
    });

    return {
      date: targetDate.toISOString().split('T')[0],
      summary: {
        totalMembers: members.length,
        presentCount,
        absentCount,
        onLeaveCount,
        fieldActiveCount,
        notStartedCount,
        pendingLeavesCount,
        pendingRegularizationsCount,
        pendingExpensesCount,
      },
      roster,
    };
  },

  async getPendingApprovals(managerId: string) {
    const teamUserIds = await this.getTeamUserIds(managerId);

    const [leaves, regularizations, expenses] = await Promise.all([
      prisma.leave.findMany({
        where: {
          userId: { in: teamUserIds },
          approvalStatus: 'PENDING',
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, employeeId: true, role: true },
          },
          leaveTypeRel: {
            select: { name: true, code: true, isPaid: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attendanceRegularization.findMany({
        where: {
          userId: { in: teamUserIds },
          status: 'PENDING',
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, employeeId: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: {
          userId: { in: teamUserIds },
          approvalStatus: 'PENDING',
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, employeeId: true, role: true },
          },
          tourPlan: {
            select: { id: true, planMonth: true, tourPurpose: true },
          },
          visit: {
            select: { id: true, visitType: true, plannedDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      leaves,
      regularizations,
      expenses,
      totalPending: leaves.length + regularizations.length + expenses.length,
    };
  },

  async settleExpense(
    expenseId: string,
    settlerId: string,
    status: 'APPROVED' | 'REJECTED',
    managerRemarks?: string
  ) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new Error('Expense claim not found');

    return prisma.expense.update({
      where: { id: expenseId },
      data: {
        approvalStatus: status,
        settledAt: status === 'APPROVED' ? new Date() : undefined,
        settledById: settlerId,
        approvedAt: new Date(),
        managerRemarks: managerRemarks || expense.managerRemarks,
        rejectionReason: status === 'REJECTED' ? managerRemarks : undefined,
      },
    });
  },

  async getTeamMonthlyPerformance(managerId: string, monthStr?: string) {
    const teamUserIds = await this.getTeamUserIds(managerId);

    // e.g. "2026-10"
    const period = monthStr || new Date().toISOString().substring(0, 7);
    const [y, m] = period.split('-');
    const startDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    const endDate = new Date(parseInt(y, 10), parseInt(m, 10), 0, 23, 59, 59, 999);

    const members = await prisma.user.findMany({
      where: { id: { in: teamUserIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        role: true,
        designation: true,
      },
    });

    const performance = await Promise.all(
      members.map(async (emp) => {
        const [visits, attendances, expenses, incentive] = await Promise.all([
          prisma.visit.findMany({
            where: {
              userId: emp.id,
              plannedDate: { gte: startDate, lte: endDate },
            },
            select: { status: true },
          }),
          prisma.attendance.findMany({
            where: {
              userId: emp.id,
              date: { gte: startDate, lte: endDate },
              status: 'PRESENT',
            },
            select: { id: true, durationMinutes: true },
          }),
          prisma.expense.findMany({
            where: {
              userId: emp.id,
              createdAt: { gte: startDate, lte: endDate },
            },
            select: { amount: true, approvalStatus: true },
          }),
          prisma.incentiveCalculation.findFirst({
            where: { userId: emp.id, period },
            select: { finalAmount: true, status: true, achievementPercent: true },
          }),
        ]);

        const plannedVisits = visits.length;
        const completedVisits = visits.filter(
          (v) => v.status === 'COMPLETED' || (v.status as string) === 'REPORTED'
        ).length;
        const coveragePct = plannedVisits > 0 ? Math.round((completedVisits / plannedVisits) * 100) : 0;

        const totalExpenseClaimed = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const totalExpenseApproved = expenses
          .filter((e) => e.approvalStatus === 'APPROVED')
          .reduce((sum, e) => sum + (e.amount || 0), 0);

        return {
          ...emp,
          daysWorked: attendances.length,
          plannedVisits,
          completedVisits,
          coveragePct,
          totalExpenseClaimed,
          totalExpenseApproved,
          incentiveEarned: incentive?.finalAmount || 0,
          targetAchievementPct: incentive?.achievementPercent || 0,
        };
      })
    );

    return {
      period,
      performance,
    };
  },
};
