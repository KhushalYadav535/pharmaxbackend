import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

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

const EMPLOYEE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  middleName: true,
  lastName: true,
  phone: true,
  role: true,
  employeeId: true,
  // FFMS Employee Master fields
  qualification: true,
  gender: true,
  maritalStatus: true,
  address1: true,
  address2: true,
  city: true,
  district: true,
  state: true,
  pin: true,
  whatsappNumber: true,
  dateOfBirth: true,
  marriageAnniversary: true,
  facebook: true,
  instagram: true,
  twitter: true,
  linkedin: true,
  spouseName: true,
  dependents: true,
  aadharNumber: true,
  panNumber: true,
  grade: true,
  // Employment fields
  designation: true,
  department: true,
  dateOfJoining: true,
  profilePhoto: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  managerId: true,
  manager: { select: { id: true, firstName: true, lastName: true, role: true } },
  hqId: true,
  hq: { select: { id: true, name: true, code: true } },
  territories: {
    include: { territory: { select: { id: true, name: true, code: true } } },
  },
} as const;

// Fields that are date strings and need conversion
const DATE_FIELDS = ['dateOfJoining', 'dateOfBirth', 'marriageAnniversary'] as const;
const VALID_GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const VALID_MARITAL_STATUSES = ['MARRIED', 'UNMARRIED', 'SEPARATED', 'DIVORCED', 'WIDOWED'];

function parseEmployeeData(data: any) {
  const parsed: any = { ...data };

  // Parse and sanitize Date fields
  for (const f of DATE_FIELDS) {
    if (parsed[f] !== undefined) {
      if (parsed[f] && typeof parsed[f] === 'string' && parsed[f].trim()) {
        const d = new Date(parsed[f]);
        parsed[f] = !isNaN(d.getTime()) ? d : null;
      } else if (parsed[f] instanceof Date && !isNaN(parsed[f].getTime())) {
        // already valid Date
      } else {
        parsed[f] = null;
      }
    }
  }

  // Dependents (must be number or null)
  if (parsed.dependents !== undefined) {
    const num = Number(parsed.dependents);
    parsed.dependents = parsed.dependents !== '' && parsed.dependents !== null && !isNaN(num) ? num : null;
  }

  // Foreign keys: managerId & hqId must be valid non-empty string or null
  if (parsed.managerId !== undefined) {
    parsed.managerId = typeof parsed.managerId === 'string' && parsed.managerId.trim() ? parsed.managerId.trim() : null;
  }
  if (parsed.hqId !== undefined) {
    parsed.hqId = typeof parsed.hqId === 'string' && parsed.hqId.trim() ? parsed.hqId.trim() : null;
  }

  // Gender enum validation
  if (parsed.gender !== undefined) {
    const g = typeof parsed.gender === 'string' ? parsed.gender.toUpperCase().trim() : '';
    parsed.gender = VALID_GENDERS.includes(g) ? g : null;
  }

  // MaritalStatus enum validation & mapping
  if (parsed.maritalStatus !== undefined) {
    let m = typeof parsed.maritalStatus === 'string' ? parsed.maritalStatus.toUpperCase().trim() : '';
    if (m === 'SINGLE') m = 'UNMARRIED';
    parsed.maritalStatus = VALID_MARITAL_STATUSES.includes(m) ? m : null;
  }

  // Optional string fields: clean empty string "" to null or trim
  const optionalTextFields = [
    'middleName', 'phone', 'whatsappNumber', 'qualification', 'address1', 'address2',
    'city', 'district', 'state', 'pin', 'facebook', 'instagram', 'twitter', 'linkedin',
    'spouseName', 'aadharNumber', 'panNumber', 'grade', 'designation', 'department',
    'profilePhoto', 'prefix', 'bloodGroup'
  ];
  for (const field of optionalTextFields) {
    if (parsed[field] !== undefined) {
      parsed[field] = typeof parsed[field] === 'string' && parsed[field].trim() ? parsed[field].trim() : null;
    }
  }

  return parsed;
}

export const employeeService = {
  async list(filters: any) {
    const { page = 1, limit = 20, search, role, isActive, managerId, hqId } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = { deletedAt: null };

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (managerId) where.managerId = managerId;
    if (hqId) where.hqId = hqId;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: EMPLOYEE_SELECT,
        skip: (p - 1) * l,
        take: l,
        orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
      }),
      prisma.user.count({ where }),
    ]);

    // Batch enrich employees with live doctor coverage & today's field activity
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const empIds = employees.map((e) => e.id);

    const [todayAttendances, todayVisits, monthDoctorVisits] = await Promise.all([
      prisma.attendance.findMany({
        where: { userId: { in: empIds }, date: { gte: startOfToday, lte: endOfToday } },
        select: { userId: true, checkInTime: true, checkOutTime: true },
      }),
      prisma.visit.findMany({
        where: { userId: { in: empIds }, plannedDate: { gte: startOfToday, lte: endOfToday } },
        select: { userId: true, visitType: true, status: true },
      }),
      prisma.visit.findMany({
        where: { userId: { in: empIds }, plannedDate: { gte: monthStart, lte: monthEnd }, visitType: 'DOCTOR', status: { in: ['COMPLETED', 'REPORTED', 'DETAILING'] } },
        select: { userId: true, doctorId: true },
      }),
    ]);

    // Pre-calculate territory doctor counts
    const allTerritoryIds = Array.from(
      new Set(
        employees.flatMap((e) => [e.hqId, ...(e.territories || []).map((t: any) => t.territoryId || t.territory?.id)]).filter(Boolean)
      )
    ) as string[];

    const territoryDoctors = allTerritoryIds.length > 0
      ? await prisma.doctor.findMany({
          where: {
            deletedAt: null,
            isActive: true,
            OR: [
              { territoryId: { in: allTerritoryIds } },
              { hqId: { in: allTerritoryIds } },
            ],
          },
          select: { id: true, territoryId: true, hqId: true },
        })
      : [];

    const enrichedEmployees = employees.map((emp) => {
      const empTerritoryIds = new Set(
        [emp.hqId, ...(emp.territories || []).map((t: any) => t.territoryId || t.territory?.id)].filter(Boolean)
      );

      const assignedDocs = territoryDoctors.filter(
        (d) => (d.territoryId && empTerritoryIds.has(d.territoryId)) || (d.hqId && empTerritoryIds.has(d.hqId))
      );

      const uniqueVisitedDocs = new Set(
        monthDoctorVisits.filter((v) => v.userId === emp.id && v.doctorId).map((v) => v.doctorId)
      );

      const att = todayAttendances.find((a) => a.userId === emp.id);
      const callsToday = todayVisits.filter((v) => v.userId === emp.id);

      const totalDocs = assignedDocs.length;
      const visitedDocs = uniqueVisitedDocs.size;
      const unvisitedDocs = Math.max(0, totalDocs - visitedDocs);
      const coverageRate = totalDocs > 0 ? Math.round((visitedDocs / totalDocs) * 100) : 0;

      return {
        ...emp,
        performanceSummary: {
          totalAssignedDoctors: totalDocs,
          visitedDoctorsCount: visitedDocs,
          unvisitedDoctorsCount: unvisitedDocs,
          coveragePercent: coverageRate,
          isCheckedInToday: !!att?.checkInTime,
          checkInTime: att?.checkInTime || null,
          callsTodayCount: callsToday.length,
          doctorCallsToday: callsToday.filter((c) => c.visitType === 'DOCTOR').length,
          retailerCallsToday: callsToday.filter((c) => c.visitType === 'RETAILER').length,
        },
      };
    });

    return { employees: enrichedEmployees, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: EMPLOYEE_SELECT,
    });
  },

  async getDossier(id: string) {
    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: EMPLOYEE_SELECT,
    });
    if (!user) return null;

    // 1. Gather all assigned territory IDs
    const territoryIds = Array.from(
      new Set(
        [user.hqId, ...(user.territories || []).map((t: any) => t.territoryId || t.territory?.id)].filter(Boolean)
      )
    ) as string[];

    // 2. Fetch all assigned doctors in this employee's territory/headquarter
    const assignedDoctors = territoryIds.length > 0
      ? await prisma.doctor.findMany({
          where: {
            deletedAt: null,
            isActive: true,
            OR: [
              { territoryId: { in: territoryIds } },
              { hqId: { in: territoryIds } },
            ],
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            doctorCode: true,
            specialty: true,
            qualification: true,
            category: true,
            classification: true,
            city: true,
            phone: true,
            hospital: { select: { id: true, name: true } },
            area: { select: { id: true, name: true } },
            hq: { select: { id: true, name: true, code: true } },
            territory: { select: { id: true, name: true, code: true } },
          },
          orderBy: [{ doctorCode: 'asc' }, { lastName: 'asc' }],
        })
      : [];

    // 3. Time bounds for this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 4. Fetch all doctor visits completed or reported by this employee this month
    const visitsThisMonth = await prisma.visit.findMany({
      where: {
        userId: id,
        plannedDate: { gte: monthStart, lte: monthEnd },
        status: { in: ['COMPLETED', 'REPORTED', 'DETAILING'] },
      },
      select: {
        id: true,
        visitType: true,
        status: true,
        doctorId: true,
        checkInTime: true,
        checkOutTime: true,
        durationMinutes: true,
        visitFeedback: true,
        notes: true,
        productsDiscussed: true,
        plannedDate: true,
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true, doctorCode: true } },
      },
      orderBy: { plannedDate: 'desc' },
    });

    // 5. Build visited vs unvisited sets
    const visitByDocMap = new Map<string, any>();
    for (const v of visitsThisMonth) {
      if (v.doctorId) {
        if (!visitByDocMap.has(v.doctorId)) {
          visitByDocMap.set(v.doctorId, {
            visitCount: 1,
            lastVisitDate: v.plannedDate || v.checkInTime,
            lastVisitFeedback: v.visitFeedback,
            lastVisitDuration: v.durationMinutes,
            lastVisitProducts: v.productsDiscussed,
            lastVisitStatus: v.status,
          });
        } else {
          visitByDocMap.get(v.doctorId).visitCount += 1;
        }
      }
    }

    const visitedDoctors: any[] = [];
    const unvisitedDoctors: any[] = [];

    for (const doc of assignedDoctors) {
      const vInfo = visitByDocMap.get(doc.id);
      if (vInfo) {
        visitedDoctors.push({
          ...doc,
          isVisited: true,
          visitCount: vInfo.visitCount,
          lastVisitDate: vInfo.lastVisitDate,
          lastVisitFeedback: vInfo.lastVisitFeedback,
          lastVisitDuration: vInfo.lastVisitDuration,
          lastVisitProducts: vInfo.lastVisitProducts,
          lastVisitStatus: vInfo.lastVisitStatus,
        });
      } else {
        unvisitedDoctors.push({
          ...doc,
          isVisited: false,
          visitCount: 0,
          lastVisitDate: null,
          lastVisitFeedback: null,
          lastVisitDuration: null,
          lastVisitProducts: [],
          lastVisitStatus: null,
        });
      }
    }

    // 6. Today's live activity and attendance
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const planMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [todayAttendance, todayVisits, activeTourPlan, monthlyOrders, monthlyExpenses, recentVisits] = await Promise.all([
      prisma.attendance.findFirst({
        where: {
          userId: id,
          date: { gte: startOfToday, lte: endOfToday },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.visit.findMany({
        where: {
          userId: id,
          plannedDate: { gte: startOfToday, lte: endOfToday },
        },
        select: {
          id: true,
          visitType: true,
          status: true,
          durationMinutes: true,
          doctor: { select: { firstName: true, lastName: true, specialty: true } },
          hospital: { select: { name: true } },
          retailer: { select: { name: true } },
        },
      }),
      // Tour plan for current month — planMonth is stored as "YYYY-MM" string
      prisma.tourPlan.findFirst({
        where: {
          userId: id,
          planMonth: planMonthStr,
        },
        include: {
          days: {
            where: { date: { gte: startOfToday, lte: endOfToday } },
            select: {
              id: true,
              date: true,
              purpose: true,
              areaId: true,
              area: { select: { name: true } },
            },
          },
        },
      }),
      prisma.order.findMany({
        where: {
          userId: id,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        include: {
          retailer: { select: { id: true, name: true, phone: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.expense.findMany({
        where: {
          userId: id,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.visit.findMany({
        where: { userId: id },
        include: {
          doctor: { select: { firstName: true, lastName: true, doctorCode: true, specialty: true } },
          hospital: { select: { name: true } },
          retailer: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    const todayCalls = {
      doctorCalls: todayVisits.filter((v) => v.visitType === 'DOCTOR').length,
      retailerCalls: todayVisits.filter((v) => v.visitType === 'RETAILER').length,
      hospitalCalls: todayVisits.filter((v) => v.visitType === 'HOSPITAL').length,
      totalCalls: todayVisits.length,
    };

    const totalRevenue = monthlyOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalExpensesAmount = monthlyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const totalDoctors = assignedDoctors.length;
    const visitedCount = visitedDoctors.length;
    const unvisitedCount = unvisitedDoctors.length;
    const coveragePercent = totalDoctors > 0 ? Math.round((visitedCount / totalDoctors) * 100) : 0;

    return {
      employee: user,
      coverage: {
        totalAssignedDoctors: totalDoctors,
        visitedDoctorsCount: visitedCount,
        unvisitedDoctorsCount: unvisitedCount,
        coveragePercentage: coveragePercent,
        visitedDoctors,
        unvisitedDoctors,
        allAssignedDoctors: [...visitedDoctors, ...unvisitedDoctors],
      },
      todayActivity: {
        attendance: todayAttendance,
        calls: todayCalls,
        visits: todayVisits,
        isCheckedIn: !!todayAttendance?.checkInTime,
        checkInTime: todayAttendance?.checkInTime || null,
        checkOutTime: todayAttendance?.checkOutTime || null,
        latitude: todayAttendance?.checkInLat ?? null,
        longitude: todayAttendance?.checkInLng ?? null,
        address: (todayAttendance as any)?.notes ?? null,
      },
      tourPlan: {
        plan: activeTourPlan,
        todaySchedule: activeTourPlan?.days?.[0] || null,
      },
      orders: {
        totalOrders: monthlyOrders.length,
        totalRevenue,
        recentOrders: monthlyOrders,
      },
      expenses: {
        totalAmount: totalExpensesAmount,
        recentExpenses: monthlyExpenses,
      },
      recentVisits,
    };
  },

  async create(data: any) {
    const { password, hqIds, ...rest } = data;
    const passwordHash = await bcrypt.hash(password, 12);

    // Auto-generate employee ID (guaranteed collision-free)
    const count = await prisma.user.count({ where: { deletedAt: null } });
    let nextNum = count + 1;
    let employeeId = `EMP${String(nextNum).padStart(5, '0')}`;
    while (await prisma.user.findUnique({ where: { employeeId } })) {
      nextNum++;
      employeeId = `EMP${String(nextNum).padStart(5, '0')}`;
    }

    const parsed = parseEmployeeData(rest);
    const validTerritoryIds = Array.isArray(hqIds)
      ? hqIds.filter((tid: any) => typeof tid === 'string' && tid.trim())
      : [];

    return prisma.user.create({
      data: {
        ...parsed,
        passwordHash,
        employeeId,
        role: parsed.role as any,
        gender: parsed.gender as any,
        maritalStatus: parsed.maritalStatus as any,
        territories: validTerritoryIds.length > 0 ? {
          create: validTerritoryIds.map((tid: string, index: number) => ({
            territoryId: tid,
            isPrimary: index === 0,
          }))
        } : undefined,
      },
      select: EMPLOYEE_SELECT,
    });
  },
  async update(id: string, data: any) {
    const { hqIds, ...rest } = data;
    const parsed = parseEmployeeData(rest);
    
    // Manage territories if hqIds provided
    if (hqIds && Array.isArray(hqIds)) {
      const validTerritoryIds = hqIds.filter((tid: any) => typeof tid === 'string' && tid.trim());
      await prisma.userTerritory.deleteMany({ where: { userId: id } });
      if (validTerritoryIds.length > 0) {
        await prisma.userTerritory.createMany({
          data: validTerritoryIds.map((tid: string, index: number) => ({
            userId: id,
            territoryId: tid,
            isPrimary: index === 0,
          }))
        });
      }
    }

    return prisma.user.update({
      where: { id },
      data: {
        ...parsed,
        role: parsed.role ? (parsed.role as any) : undefined,
        gender: parsed.gender !== undefined ? (parsed.gender as any) : undefined,
        maritalStatus: parsed.maritalStatus !== undefined ? (parsed.maritalStatus as any) : undefined,
      },
      select: EMPLOYEE_SELECT,
    });
  },
  async deactivate(id: string) {
    return prisma.user.update({ where: { id }, data: { isActive: false }, select: { id: true, isActive: true } });
  },

  async reactivate(id: string) {
    return prisma.user.update({ where: { id }, data: { isActive: true }, select: { id: true, isActive: true } });
  },

  async resetPassword(id: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    return prisma.user.update({ where: { id }, data: { passwordHash }, select: { id: true } });
  },

  async softDelete(id: string) {
    return prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false }, select: { id: true } });
  },

  // Assign territory to employee
  async assignTerritory(userId: string, territoryId: string, isPrimary = false) {
    return prisma.userTerritory.upsert({
      where: { userId_territoryId: { userId, territoryId } },
      update: { isPrimary },
      create: { userId, territoryId, isPrimary },
    });
  },

  async removeTerritory(userId: string, territoryId: string) {
    return prisma.userTerritory.deleteMany({ where: { userId, territoryId } });
  },

  // ── Live MR Telemetry: Online / Offline, Session Duration, & Unplanned Call Flagging ──
  async getLiveTelemetry(requestingUserId: string, userRole: string) {
    const isSuperAdmin = ['SUPER_ADMIN', 'SALES_ADMIN', 'ADMIN'].includes(userRole);
    
    // Determine which MRs to monitor
    let mrWhere: Prisma.UserWhereInput = {
      deletedAt: null,
      isActive: true,
      role: { in: ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'] },
    };

    if (!isSuperAdmin) {
      // Manager: see their direct reports and subordinates
      const reporteeIds = await getHierarchyIds(requestingUserId);
      mrWhere.id = { in: [requestingUserId, ...reporteeIds] };
    }

    const mrs = await prisma.user.findMany({
      where: mrWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        email: true,
        role: true,
        profilePhoto: true,
        lastLoginAt: true,
        lastActiveAt: true,
        lastLogoutAt: true,
        hq: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ firstName: 'asc' }],
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const mrIds = mrs.map((m) => m.id);

    // Fetch today's attendance & visits for all MRs
    const [todayAttendances, todayVisits, monthUnplannedGroup] = await Promise.all([
      prisma.attendance.findMany({
        where: { userId: { in: mrIds }, date: { gte: startOfToday, lte: endOfToday } },
        select: { userId: true, checkInTime: true, checkOutTime: true, dayStatus: true },
      }),
      prisma.visit.findMany({
        where: { userId: { in: mrIds }, plannedDate: { gte: startOfToday, lte: endOfToday } },
        select: {
          id: true,
          userId: true,
          status: true,
          isUnplanned: true,
          unplannedReason: true,
          checkInTime: true,
          doctor: { select: { id: true, firstName: true, lastName: true } },
          hospital: { select: { id: true, name: true } },
        },
      }),
      prisma.visit.groupBy({
        by: ['userId'],
        where: { userId: { in: mrIds }, plannedDate: { gte: startOfMonth, lte: endOfToday }, isUnplanned: true },
        _count: true,
      }),
    ]);

    const monthUnplannedMap = new Map<string, number>();
    monthUnplannedGroup.forEach((g) => monthUnplannedMap.set(g.userId, g._count));

    const nowTime = now.getTime();
    const telemetry = mrs.map((mr) => {
      const att = todayAttendances.find((a) => a.userId === mr.id);
      const visits = todayVisits.filter((v) => v.userId === mr.id);
      const unplannedVisits = visits.filter((v) => v.isUnplanned);
      const plannedVisits = visits.filter((v) => !v.isUnplanned);
      const completedVisits = visits.filter((v) => ['COMPLETED', 'REPORTED'].includes(v.status));

      // Calculate Online / Login Status
      const lastLogin = mr.lastLoginAt ? new Date(mr.lastLoginAt) : null;
      const lastActive = mr.lastActiveAt ? new Date(mr.lastActiveAt) : null;
      const lastLogout = mr.lastLogoutAt ? new Date(mr.lastLogoutAt) : null;

      const hasCheckedInToday = !!att?.checkInTime && !att?.checkOutTime && att.dayStatus === 'IN_PROGRESS';
      const recentActivity = lastActive ? (nowTime - lastActive.getTime()) < 30 * 60 * 1000 : false;
      const loggedInNoLogout = lastLogin ? (!lastLogout || lastLogout < lastLogin) : false;

      let status: 'ONLINE' | 'AWAY' | 'OFFLINE' = 'OFFLINE';
      if (loggedInNoLogout && (recentActivity || hasCheckedInToday)) {
        status = 'ONLINE';
      } else if (loggedInNoLogout && lastLogin && (nowTime - lastLogin.getTime()) < 12 * 60 * 60 * 1000) {
        status = 'AWAY';
      } else {
        status = 'OFFLINE';
      }

      // Calculate Session Duration
      let sessionMinutes = 0;
      let formattedDuration = '0m';
      if (status === 'ONLINE' || status === 'AWAY') {
        const sessionStart = lastLogin || (att?.checkInTime ? new Date(att.checkInTime) : lastActive);
        if (sessionStart) {
          sessionMinutes = Math.max(0, Math.round((nowTime - sessionStart.getTime()) / 60000));
          const h = Math.floor(sessionMinutes / 60);
          const m = sessionMinutes % 60;
          formattedDuration = h > 0 ? `${h}h ${m}m` : `${m}m`;
        }
      } else if (lastLogin && lastLogout && lastLogout > lastLogin && (nowTime - lastLogout.getTime()) < 24 * 60 * 60 * 1000) {
        sessionMinutes = Math.max(0, Math.round((lastLogout.getTime() - lastLogin.getTime()) / 60000));
        const h = Math.floor(sessionMinutes / 60);
        const m = sessionMinutes % 60;
        formattedDuration = h > 0 ? `${h}h ${m}m` : `${m}m`;
      }

      // Unplanned Call Flags
      const totalVisitsCount = visits.length;
      const unplannedCount = unplannedVisits.length;
      const unplannedRatio = totalVisitsCount > 0 ? Math.round((unplannedCount / totalVisitsCount) * 100) : 0;
      const isFlagged = unplannedCount >= 2 || (totalVisitsCount >= 3 && unplannedRatio >= 40);
      let flagReason: string | null = null;
      if (unplannedCount >= 2) {
        flagReason = `${unplannedCount} unplanned calls logged today`;
      } else if (totalVisitsCount >= 3 && unplannedRatio >= 40) {
        flagReason = `${unplannedRatio}% of today's calls are unplanned`;
      }

      return {
        id: mr.id,
        name: `${mr.firstName} ${mr.lastName}`.trim(),
        firstName: mr.firstName,
        lastName: mr.lastName,
        employeeId: mr.employeeId,
        email: mr.email,
        role: mr.role,
        profilePhoto: mr.profilePhoto,
        hq: mr.hq,
        status, // ONLINE | AWAY | OFFLINE
        isOnline: status === 'ONLINE',
        lastLoginAt: mr.lastLoginAt,
        lastActiveAt: mr.lastActiveAt,
        lastLogoutAt: mr.lastLogoutAt,
        sessionMinutes,
        formattedDuration,
        dayStatus: att?.dayStatus || 'NOT_STARTED',
        todayMetrics: {
          totalVisits: totalVisitsCount,
          plannedVisits: plannedVisits.length,
          completedVisits: completedVisits.length,
          unplannedVisits: unplannedCount,
          unplannedRatio,
        },
        monthUnplannedCount: monthUnplannedMap.get(mr.id) || 0,
        isFlagged,
        flagReason,
        recentUnplannedCalls: unplannedVisits.slice(0, 3).map((v) => ({
          id: v.id,
          doctorName: v.doctor ? `Dr. ${v.doctor.firstName} ${v.doctor.lastName}` : null,
          hospitalName: v.hospital?.name || null,
          time: v.checkInTime || null,
          reason: v.unplannedReason || 'Field Direct Unplanned Visit',
        })),
      };
    });

    const onlineCount = telemetry.filter((t) => t.status === 'ONLINE').length;
    const awayCount = telemetry.filter((t) => t.status === 'AWAY').length;
    const offlineCount = telemetry.filter((t) => t.status === 'OFFLINE').length;
    const flaggedCount = telemetry.filter((t) => t.isFlagged).length;
    const totalUnplannedToday = telemetry.reduce((sum, t) => sum + t.todayMetrics.unplannedVisits, 0);

    return {
      summary: {
        totalMRs: mrs.length,
        onlineCount,
        awayCount,
        offlineCount,
        flaggedCount,
        totalUnplannedToday,
      },
      telemetry,
    };
  },
};
