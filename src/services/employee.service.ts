import prisma from '../config/database';
import bcrypt from 'bcryptjs';

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

function parseEmployeeData(data: any) {
  const parsed: any = { ...data };
  for (const f of DATE_FIELDS) {
    if (parsed[f] !== undefined) {
      parsed[f] = parsed[f] ? new Date(parsed[f]) : null;
    }
  }
  if (parsed.dependents !== undefined) {
    parsed.dependents = parsed.dependents !== '' && parsed.dependents !== null ? Number(parsed.dependents) : null;
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

    // Auto-generate employee ID
    const count = await prisma.user.count({ where: { deletedAt: null } });
    const employeeId = `EMP${String(count + 1).padStart(5, '0')}`;

    const parsed = parseEmployeeData(rest);

    return prisma.user.create({
      data: {
        ...parsed,
        passwordHash,
        employeeId,
        role: parsed.role as any,
        gender: parsed.gender as any,
        maritalStatus: parsed.maritalStatus as any,
        territories: hqIds && Array.isArray(hqIds) ? {
          create: hqIds.map((tid: string, index: number) => ({
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
      await prisma.userTerritory.deleteMany({ where: { userId: id } });
      if (hqIds.length > 0) {
        await prisma.userTerritory.createMany({
          data: hqIds.map((tid: string, index: number) => ({
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
        role: parsed.role as any,
        gender: parsed.gender as any,
        maritalStatus: parsed.maritalStatus as any,
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
};
