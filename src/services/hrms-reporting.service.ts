import prisma from '../config/database';

export const hrmsReportingService = {
  // ── Full Organization Reporting Tree ──────────────────────────────────────
  async getReportingTree() {
    // Fetch all active employees
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        role: true,
        email: true,
        phone: true,
        designation: true,
        department: true,
        employmentStatus: true,
        managerId: true,
        hq: { select: { id: true, name: true, code: true } },
        designationRel: { select: { id: true, name: true, code: true } },
        departmentRel: { select: { id: true, name: true, code: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    // Build hierarchy tree
    const userMap = new Map<string, any>();
    users.forEach((u) => {
      userMap.set(u.id, { ...u, reports: [] });
    });

    const roots: any[] = [];

    users.forEach((u) => {
      const node = userMap.get(u.id);
      if (u.managerId && userMap.has(u.managerId)) {
        userMap.get(u.managerId).reports.push(node);
      } else {
        roots.push(node);
      }
    });

    return { roots, totalEmployees: users.length };
  },

  // ── Team Members for a Specific Manager (Direct & Indirect) ───────────────
  async getTeamHierarchy(managerId: string) {
    const directReports = await prisma.user.findMany({
      where: { managerId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        role: true,
        email: true,
        phone: true,
        designation: true,
        department: true,
        employmentStatus: true,
        hq: { select: { id: true, name: true, code: true } },
      },
    });

    // Recursively collect all indirect report IDs
    const collectHierarchy = async (currentManagerId: string): Promise<any[]> => {
      const subs = await prisma.user.findMany({
        where: { managerId: currentManagerId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          role: true,
          designation: true,
          managerId: true,
          hq: { select: { id: true, name: true } },
        },
      });

      let allSubs: any[] = [...subs];
      for (const s of subs) {
        const nested = await collectHierarchy(s.id);
        allSubs.push(...nested);
      }
      return allSubs;
    };

    const allTeam = await collectHierarchy(managerId);

    return {
      directReports,
      totalDirect: directReports.length,
      allTeamMembers: allTeam,
      totalTeam: allTeam.length,
    };
  },
};
