import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export interface MRUsageFilterParams {
  timeRange?: string; // 'today' | 'yesterday' | 'this_week' | 'last_7_days' | 'this_month' | 'last_month' | 'last_30_days' | 'custom'
  startDate?: string;
  endDate?: string;
  search?: string;
  hqId?: string;
  status?: string; // 'ALL' | 'ONLINE' | 'OFFLINE'
  mrId?: string;
  requestingUserId?: string;
  requestingUserRole?: string;
}

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

export function formatMinutes(totalMins: number): string {
  if (!totalMins || totalMins <= 0) return '0m';
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatTime12h(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const mrUsageService = {
  parseDateRange(timeRange: string = 'this_month', customStart?: string, customEnd?: string) {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let label = 'This Month';

    switch (timeRange.toLowerCase()) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        label = 'Today';
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        label = 'Yesterday';
        break;
      case 'this_week':
        const dayOfWeek = now.getDay(); // 0 is Sunday
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
        label = 'This Week';
        break;
      case 'last_7_days':
        start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        label = 'Last 7 Days';
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        label = 'Last Month';
        break;
      case 'last_30_days':
        start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        label = 'Last 30 Days';
        break;
      case 'custom':
        if (customStart) {
          start = new Date(customStart);
          start.setHours(0, 0, 0, 0);
        } else {
          start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        }
        if (customEnd) {
          end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
        }
        label = `${formatDateStr(start)} to ${formatDateStr(end)}`;
        break;
      case 'this_month':
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        label = 'This Month';
        break;
    }

    return { start, end, label };
  },

  async getMRUsageOverview(params: MRUsageFilterParams) {
    const {
      timeRange = 'this_month',
      startDate,
      endDate,
      search,
      hqId,
      status: statusFilter = 'ALL',
      mrId,
      requestingUserId,
      requestingUserRole = 'SUPER_ADMIN',
    } = params;

    const { start: rangeStart, end: rangeEnd, label: rangeLabel } = this.parseDateRange(timeRange, startDate, endDate);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const nowTime = now.getTime();

    // 1. Build MR where clause
    const isSuperAdmin = ['SUPER_ADMIN', 'SALES_ADMIN', 'ADMIN'].includes(requestingUserRole);
    const mrWhere: Prisma.UserWhereInput = {
      deletedAt: null,
      isActive: true,
      role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'] },
    };

    if (!isSuperAdmin && requestingUserId) {
      const reporteeIds = await getHierarchyIds(requestingUserId);
      mrWhere.id = { in: [requestingUserId, ...reporteeIds] };
    }

    if (mrId) {
      mrWhere.id = mrId;
    }

    if (hqId && hqId !== 'ALL') {
      mrWhere.hqId = hqId;
    }

    if (search && search.trim()) {
      const q = search.trim();
      mrWhere.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { employeeId: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { hq: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // 2. Query matching MRs
    const mrs = await prisma.user.findMany({
      where: mrWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        email: true,
        phone: true,
        role: true,
        profilePhoto: true,
        designation: true,
        lastLoginAt: true,
        lastActiveAt: true,
        lastLogoutAt: true,
        hq: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ firstName: 'asc' }],
    });

    const mrIds = mrs.map((m) => m.id);

    if (mrIds.length === 0) {
      return {
        summary: {
          totalMRs: 0,
          onlineCount: 0,
          awayCount: 0,
          offlineCount: 0,
          totalLogins: 0,
          totalLogouts: 0,
          totalAppHoursFormatted: '0h',
          totalAppMinutes: 0,
          avgDailyHoursFormatted: '0h',
          topActiveMR: null,
          leastActiveMR: null,
        },
        dateRange: {
          startDate: formatDateStr(rangeStart),
          endDate: formatDateStr(rangeEnd),
          label: rangeLabel,
        },
        mrList: [],
      };
    }

    // 3. Query all sessions in range & today's attendances + visits
    const [rangeSessions, todayAttendances, todayVisits] = await Promise.all([
      prisma.userSession.findMany({
        where: {
          userId: { in: mrIds },
          loginAt: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { loginAt: 'desc' },
      }),
      prisma.attendance.findMany({
        where: {
          userId: { in: mrIds },
          date: { gte: startOfToday, lte: endOfToday },
        },
        select: { userId: true, checkInTime: true, checkOutTime: true, dayStatus: true, status: true },
      }),
      prisma.visit.findMany({
        where: {
          userId: { in: mrIds },
          plannedDate: { gte: startOfToday, lte: endOfToday },
        },
        select: { userId: true, status: true },
      }),
    ]);

    // Group sessions by userId
    const sessionsByMR = new Map<string, typeof rangeSessions>();
    for (const sess of rangeSessions) {
      if (!sessionsByMR.has(sess.userId)) {
        sessionsByMR.set(sess.userId, []);
      }
      sessionsByMR.get(sess.userId)!.push(sess);
    }

    // 4. Compute metrics per MR
    const mrList = mrs.map((mr) => {
      const sessions = sessionsByMR.get(mr.id) || [];
      const att = todayAttendances.find((a) => a.userId === mr.id);
      const visits = todayVisits.filter((v) => v.userId === mr.id);
      const completedVisitsToday = visits.filter((v) => ['COMPLETED', 'REPORTED'].includes(v.status)).length;

      // Realtime Online / Away / Offline Status
      const lastLogin = mr.lastLoginAt ? new Date(mr.lastLoginAt) : null;
      const lastActive = mr.lastActiveAt ? new Date(mr.lastActiveAt) : null;
      const lastLogout = mr.lastLogoutAt ? new Date(mr.lastLogoutAt) : null;

      const hasActiveSession = sessions.some((s) => s.status === 'ACTIVE');
      const recentActivity = lastActive ? nowTime - lastActive.getTime() < 15 * 60 * 1000 : false;
      const awayActivity = lastActive ? nowTime - lastActive.getTime() < 60 * 60 * 1000 : false;
      const loggedInNoLogout = lastLogin ? !lastLogout || lastLogout < lastLogin : false;

      let currentStatus: 'ONLINE' | 'AWAY' | 'OFFLINE' = 'OFFLINE';
      if (hasActiveSession || (loggedInNoLogout && recentActivity)) {
        currentStatus = 'ONLINE';
      } else if (loggedInNoLogout && (awayActivity || hasActiveSession)) {
        currentStatus = 'AWAY';
      } else {
        currentStatus = 'OFFLINE';
      }

      // Last active relative string
      let lastActiveFormatted = 'Never';
      if (lastActive) {
        const diffMinutes = Math.round((nowTime - lastActive.getTime()) / 60000);
        if (diffMinutes < 2) lastActiveFormatted = 'Active right now';
        else if (diffMinutes < 60) lastActiveFormatted = `${diffMinutes}m ago`;
        else {
          const diffHours = Math.floor(diffMinutes / 60);
          if (diffHours < 24) lastActiveFormatted = `${diffHours}h ago`;
          else lastActiveFormatted = `${Math.floor(diffHours / 24)}d ago`;
        }
      }

      // Range sessions aggregation
      const totalLogins = sessions.length;
      const totalLogouts = sessions.filter((s) => s.status === 'LOGGED_OUT' || !!s.logoutAt).length;

      let totalMinutes = 0;
      const activeDatesSet = new Set<string>();

      for (const s of sessions) {
        let dur = s.durationMinutes || 0;
        // If active session right now, calculate live duration
        if (s.status === 'ACTIVE' && s.loginAt) {
          dur = Math.max(1, Math.round((nowTime - new Date(s.loginAt).getTime()) / 60000));
        }
        totalMinutes += dur;
        activeDatesSet.add(formatDateStr(new Date(s.loginAt)));
      }

      const activeDaysCount = activeDatesSet.size;
      const avgDailyMinutes = activeDaysCount > 0 ? Math.round(totalMinutes / activeDaysCount) : 0;

      // Today sessions aggregation
      const todaySessions = sessions.filter((s) => new Date(s.loginAt) >= startOfToday);
      const todayLogins = todaySessions.length;
      const todayLogouts = todaySessions.filter((s) => s.status === 'LOGGED_OUT' || !!s.logoutAt).length;
      let todayMinutes = 0;
      for (const s of todaySessions) {
        let dur = s.durationMinutes || 0;
        if (s.status === 'ACTIVE' && s.loginAt) {
          dur = Math.max(1, Math.round((nowTime - new Date(s.loginAt).getTime()) / 60000));
        }
        todayMinutes += dur;
      }

      return {
        id: mr.id,
        name: `${mr.firstName} ${mr.lastName}`.trim(),
        firstName: mr.firstName,
        lastName: mr.lastName,
        employeeId: mr.employeeId || 'EMP',
        email: mr.email,
        phone: mr.phone || 'N/A',
        role: mr.role,
        profilePhoto: mr.profilePhoto,
        designation: mr.designation || 'Medical Representative',
        hq: mr.hq || { id: 'hq', name: 'General Territory', code: 'GEN' },
        currentStatus,
        isOnline: currentStatus === 'ONLINE',
        lastLoginAt: mr.lastLoginAt,
        lastLogoutAt: mr.lastLogoutAt,
        lastActiveAt: mr.lastActiveAt,
        lastActiveFormatted,
        // Selected Range Metrics
        totalLogins,
        totalLogouts,
        totalMinutes,
        totalHoursFormatted: formatMinutes(totalMinutes),
        totalHoursDecimal: parseFloat((totalMinutes / 60).toFixed(1)),
        activeDaysCount,
        avgDailyMinutes,
        avgDailyHoursFormatted: formatMinutes(avgDailyMinutes),
        // Today Metrics
        todayLogins,
        todayLogouts,
        todayMinutes,
        todayHoursFormatted: formatMinutes(todayMinutes),
        todayAttendanceStatus: att?.status || 'NOT_MARKED',
        todayDayStatus: att?.dayStatus || 'NOT_STARTED',
        todayVisitsCompleted: completedVisitsToday,
      };
    });

    // 5. Apply status filter if requested
    const filteredList = statusFilter === 'ALL'
      ? mrList
      : mrList.filter((m) => m.currentStatus === statusFilter);

    // 6. Calculate Team Summary
    const onlineCount = mrList.filter((m) => m.currentStatus === 'ONLINE').length;
    const awayCount = mrList.filter((m) => m.currentStatus === 'AWAY').length;
    const offlineCount = mrList.filter((m) => m.currentStatus === 'OFFLINE').length;

    const totalLoginsTeam = mrList.reduce((acc, m) => acc + m.totalLogins, 0);
    const totalLogoutsTeam = mrList.reduce((acc, m) => acc + m.totalLogouts, 0);
    const totalAppMinutesTeam = mrList.reduce((acc, m) => acc + m.totalMinutes, 0);
    const avgAppMinutesPerMR = mrList.length > 0 ? Math.round(totalAppMinutesTeam / mrList.length) : 0;

    // Sort by usage to find top and least active
    const sortedByUsage = [...mrList].sort((a, b) => b.totalMinutes - a.totalMinutes);
    const topActiveMR = sortedByUsage.length > 0 && sortedByUsage[0].totalMinutes > 0
      ? {
          name: sortedByUsage[0].name,
          employeeId: sortedByUsage[0].employeeId,
          hoursFormatted: sortedByUsage[0].totalHoursFormatted,
          logins: sortedByUsage[0].totalLogins,
        }
      : null;

    const leastActiveMR = sortedByUsage.length > 0
      ? {
          name: sortedByUsage[sortedByUsage.length - 1].name,
          employeeId: sortedByUsage[sortedByUsage.length - 1].employeeId,
          hoursFormatted: sortedByUsage[sortedByUsage.length - 1].totalHoursFormatted,
          logins: sortedByUsage[sortedByUsage.length - 1].totalLogins,
        }
      : null;

    return {
      summary: {
        totalMRs: mrs.length,
        onlineCount,
        awayCount,
        offlineCount,
        totalLogins: totalLoginsTeam,
        totalLogouts: totalLogoutsTeam,
        totalAppMinutes: totalAppMinutesTeam,
        totalAppHoursFormatted: formatMinutes(totalAppMinutesTeam),
        avgDailyHoursFormatted: formatMinutes(avgAppMinutesPerMR),
        topActiveMR,
        leastActiveMR,
      },
      dateRange: {
        startDate: formatDateStr(rangeStart),
        endDate: formatDateStr(rangeEnd),
        label: rangeLabel,
      },
      mrList: filteredList,
    };
  },

  async getMRIndividualReport(mrId: string, params: MRUsageFilterParams) {
    const { timeRange = 'this_month', startDate, endDate } = params;
    const { start: rangeStart, end: rangeEnd, label: rangeLabel } = this.parseDateRange(timeRange, startDate, endDate);

    // 1. Fetch MR details
    const mr = await prisma.user.findUnique({
      where: { id: mrId },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        employeeId: true,
        email: true,
        phone: true,
        role: true,
        profilePhoto: true,
        designation: true,
        department: true,
        dateOfJoining: true,
        lastLoginAt: true,
        lastActiveAt: true,
        lastLogoutAt: true,
        hq: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
      },
    });

    if (!mr) {
      throw new Error('Medical Representative not found');
    }

    const now = new Date();
    const nowTime = now.getTime();

    // 2. Fetch Sessions in date range
    const sessions = await prisma.userSession.findMany({
      where: {
        userId: mrId,
        loginAt: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { loginAt: 'desc' },
    });

    // 3. Fetch Attendances in date range
    const attendances = await prisma.attendance.findMany({
      where: {
        userId: mrId,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        date: true,
        status: true,
        dayStatus: true,
        checkInTime: true,
        checkOutTime: true,
      },
    });

    // 4. Fetch completed visits in date range
    const visits = await prisma.visit.findMany({
      where: {
        userId: mrId,
        plannedDate: { gte: rangeStart, lte: rangeEnd },
        status: { in: ['COMPLETED', 'REPORTED'] },
      },
      select: { plannedDate: true, id: true },
    });

    // 5. Aggregate overall metrics
    const totalLogins = sessions.length;
    const totalLogouts = sessions.filter((s) => s.status === 'LOGGED_OUT' || !!s.logoutAt).length;
    let totalMinutes = 0;
    const activeDatesSet = new Set<string>();

    for (const s of sessions) {
      let dur = s.durationMinutes || 0;
      if (s.status === 'ACTIVE' && s.loginAt) {
        dur = Math.max(1, Math.round((nowTime - new Date(s.loginAt).getTime()) / 60000));
      }
      totalMinutes += dur;
      activeDatesSet.add(formatDateStr(new Date(s.loginAt)));
    }

    const activeDaysCount = activeDatesSet.size;
    const avgDailyMinutes = activeDaysCount > 0 ? Math.round(totalMinutes / activeDaysCount) : 0;
    const avgSessionMinutes = totalLogins > 0 ? Math.round(totalMinutes / totalLogins) : 0;

    // Realtime status
    const lastLogin = mr.lastLoginAt ? new Date(mr.lastLoginAt) : null;
    const lastActive = mr.lastActiveAt ? new Date(mr.lastActiveAt) : null;
    const lastLogout = mr.lastLogoutAt ? new Date(mr.lastLogoutAt) : null;

    const hasActiveSession = sessions.some((s) => s.status === 'ACTIVE');
    const recentActivity = lastActive ? nowTime - lastActive.getTime() < 15 * 60 * 1000 : false;
    const awayActivity = lastActive ? nowTime - lastActive.getTime() < 60 * 60 * 1000 : false;
    const loggedInNoLogout = lastLogin ? !lastLogout || lastLogout < lastLogin : false;

    let currentStatus: 'ONLINE' | 'AWAY' | 'OFFLINE' = 'OFFLINE';
    if (hasActiveSession || (loggedInNoLogout && recentActivity)) {
      currentStatus = 'ONLINE';
    } else if (loggedInNoLogout && (awayActivity || hasActiveSession)) {
      currentStatus = 'AWAY';
    } else {
      currentStatus = 'OFFLINE';
    }

    // 6. Day-by-Day Usage Breakdown Timeline
    // Generate each day between rangeStart and rangeEnd (inclusive, capped to today)
    const dayBreakdown: any[] = [];
    const currentDate = new Date(rangeStart);
    currentDate.setHours(0, 0, 0, 0);

    const effectiveEnd = rangeEnd > now ? now : rangeEnd;

    while (currentDate <= effectiveEnd) {
      const dateStr = formatDateStr(currentDate);
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Sessions on this day
      const daySessions = sessions.filter((s) => {
        const lTime = new Date(s.loginAt);
        return lTime >= dayStart && lTime <= dayEnd;
      });

      let dayTotalMinutes = 0;
      let firstLogin: Date | null = null;
      let lastLogoutDate: Date | null = null;
      let isStillActiveToday = false;

      for (const s of daySessions) {
        let dur = s.durationMinutes || 0;
        if (s.status === 'ACTIVE' && s.loginAt) {
          dur = Math.max(1, Math.round((nowTime - new Date(s.loginAt).getTime()) / 60000));
          isStillActiveToday = true;
        }
        dayTotalMinutes += dur;

        const sLogin = new Date(s.loginAt);
        if (!firstLogin || sLogin < firstLogin) firstLogin = sLogin;

        if (s.logoutAt) {
          const sLogout = new Date(s.logoutAt);
          if (!lastLogoutDate || sLogout > lastLogoutDate) lastLogoutDate = sLogout;
        }
      }

      // Attendance on this day
      const dayAttendance = attendances.find((a) => formatDateStr(new Date(a.date)) === dateStr);

      // Visits on this day
      const dayVisitsCount = visits.filter((v) => formatDateStr(new Date(v.plannedDate)) === dateStr).length;

      const dayOfWeekName = currentDate.toLocaleDateString('en-IN', { weekday: 'short' });
      const formattedDisplayDate = currentDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      dayBreakdown.push({
        date: dateStr,
        displayDate: formattedDisplayDate,
        dayOfWeek: dayOfWeekName,
        isWeekend: currentDate.getDay() === 0,
        loginCount: daySessions.length,
        logoutCount: daySessions.filter((s) => s.status === 'LOGGED_OUT' || !!s.logoutAt).length,
        totalMinutes: dayTotalMinutes,
        totalHoursFormatted: formatMinutes(dayTotalMinutes),
        firstLoginTime: formatTime12h(firstLogin),
        lastLogoutTime: isStillActiveToday ? 'Active Now' : formatTime12h(lastLogoutDate),
        attendanceStatus: dayAttendance?.status || (currentDate.getDay() === 0 ? 'SUNDAY' : daySessions.length > 0 ? 'PRESENT' : 'NOT_MARKED'),
        dayStatus: dayAttendance?.dayStatus || (daySessions.length > 0 ? 'IN_PROGRESS' : 'NOT_STARTED'),
        visitsCompleted: dayVisitsCount,
      });

      // Advance one day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort days descending (most recent first)
    dayBreakdown.reverse();

    // 7. Full Session History Logs
    const sessionLogs = sessions.map((s) => {
      let dur = s.durationMinutes || 0;
      if (s.status === 'ACTIVE' && s.loginAt) {
        dur = Math.max(1, Math.round((nowTime - new Date(s.loginAt).getTime()) / 60000));
      }

      const loginD = new Date(s.loginAt);
      const logoutD = s.logoutAt ? new Date(s.logoutAt) : null;

      return {
        id: s.id,
        loginAt: s.loginAt,
        logoutAt: s.logoutAt,
        loginDateStr: loginD.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        loginTimeStr: formatTime12h(loginD),
        logoutDateStr: logoutD ? logoutD.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
        logoutTimeStr: s.status === 'ACTIVE' ? 'Active Now' : formatTime12h(logoutD),
        durationMinutes: dur,
        durationFormatted: formatMinutes(dur),
        status: s.status, // ACTIVE | LOGGED_OUT | TIMED_OUT
        logoutReason: s.logoutReason || (s.status === 'ACTIVE' ? null : 'MANUAL'),
        platform: s.platform || 'ANDROID',
        deviceModel: s.deviceModel || 'Mobile Device',
        ipAddress: s.ipAddress || '192.168.1.1',
        appVersion: s.appVersion || '1.0.4',
      };
    });

    return {
      mr: {
        id: mr.id,
        name: `${mr.firstName} ${mr.lastName}`.trim(),
        firstName: mr.firstName,
        lastName: mr.lastName,
        employeeId: mr.employeeId || 'EMP',
        email: mr.email,
        phone: mr.phone || 'N/A',
        role: mr.role,
        profilePhoto: mr.profilePhoto,
        designation: mr.designation || 'Medical Representative',
        department: mr.department || 'Field Sales',
        dateOfJoining: mr.dateOfJoining,
        hq: mr.hq || { id: 'hq', name: 'General HQ', code: 'GEN' },
        manager: mr.manager ? `${mr.manager.firstName} ${mr.manager.lastName}` : 'Unassigned',
        currentStatus,
        isOnline: currentStatus === 'ONLINE',
        lastLoginAt: mr.lastLoginAt,
        lastLogoutAt: mr.lastLogoutAt,
        lastActiveAt: mr.lastActiveAt,
      },
      metrics: {
        totalLogins,
        totalLogouts,
        totalMinutes,
        totalHoursFormatted: formatMinutes(totalMinutes),
        totalHoursDecimal: parseFloat((totalMinutes / 60).toFixed(1)),
        activeDaysCount,
        avgDailyMinutes,
        avgDailyHoursFormatted: formatMinutes(avgDailyMinutes),
        avgSessionMinutes,
        avgSessionFormatted: formatMinutes(avgSessionMinutes),
      },
      dateRange: {
        startDate: formatDateStr(rangeStart),
        endDate: formatDateStr(rangeEnd),
        label: rangeLabel,
      },
      dayBreakdown,
      sessionLogs,
    };
  },
};

let isUserSessionsTableReady = false;

export async function ensureUserSessionsTable() {
  if (isUserSessionsTableReady) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" TEXT,
        "loginAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "logoutAt" TIMESTAMP(3),
        "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "durationMinutes" INTEGER NOT NULL DEFAULT 0,
        "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "ipAddress" VARCHAR(128),
        "userAgent" TEXT,
        "deviceModel" VARCHAR(128),
        "platform" VARCHAR(64) DEFAULT 'ANDROID',
        "appVersion" VARCHAR(64) DEFAULT '1.0.4',
        "logoutReason" VARCHAR(64),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "user_sessions_userId_loginAt_idx" ON "user_sessions"("userId", "loginAt");
      CREATE INDEX IF NOT EXISTS "user_sessions_userId_status_idx" ON "user_sessions"("userId", "status");
      CREATE INDEX IF NOT EXISTS "user_sessions_loginAt_idx" ON "user_sessions"("loginAt");
    `);
    isUserSessionsTableReady = true;
  } catch (err) {
    console.error('Failed to ensure user_sessions table:', err);
  }
}

