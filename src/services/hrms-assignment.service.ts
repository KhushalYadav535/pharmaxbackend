import prisma from '../config/database';

export interface AssignTerritoryInput {
  userId: string;
  divisionId?: string;
  regionId?: string;
  areaId?: string;
  hqId?: string;
  territoryId?: string;
  managerId?: string;
  effectiveFrom?: string | Date;
  reason?: string;
  assignedById?: string;
}

export interface CreateMovementInput {
  userId: string;
  movementType: string;
  effectiveDate?: string | Date;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  approvedById?: string;
  supportingDocUrl?: string;
  status?: string;
}

export const hrmsAssignmentService = {
  // ── Assignment History for User ───────────────────────────────────────────
  async getUserAssignments(userId: string) {
    return prisma.employeeAssignment.findMany({
      where: { userId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        division: true,
        area: true,
        hq: { select: { id: true, name: true, code: true, state: true } },
        territory: { select: { id: true, name: true, code: true, state: true } },
        manager: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
  },

  // ── Effective-Dated Territory Assignment / Transfer ────────────────────────
  async assignTerritory(input: AssignTerritoryInput) {
    const effectiveDate = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();

    // 1. Fetch user's current assignment
    const currentAssignment = await prisma.employeeAssignment.findFirst({
      where: { userId: input.userId, isCurrent: true },
      include: {
        hq: true,
        territory: true,
        manager: true,
      },
    });

    // 2. Close current assignment if exists
    if (currentAssignment) {
      await prisma.employeeAssignment.update({
        where: { id: currentAssignment.id },
        data: {
          isCurrent: false,
          effectiveTo: effectiveDate,
        },
      });
    }

    // 3. Create new assignment
    const newAssignment = await prisma.employeeAssignment.create({
      data: {
        userId: input.userId,
        divisionId: input.divisionId || null,
        regionId: input.regionId || null,
        areaId: input.areaId || null,
        hqId: input.hqId || null,
        territoryId: input.territoryId || input.hqId || null,
        managerId: input.managerId || null,
        effectiveFrom: effectiveDate,
        isCurrent: true,
        reason: input.reason || 'Territory Allocation / Transfer',
        assignedById: input.assignedById || null,
      },
      include: {
        division: true,
        hq: true,
        territory: true,
        manager: true,
      },
    });

    // 4. Keep User master aligned for backward compatibility
    const userUpdate: any = {};
    if (input.hqId || input.territoryId) userUpdate.hqId = input.hqId || input.territoryId;
    if (input.managerId !== undefined) userUpdate.managerId = input.managerId || null;
    if (input.divisionId !== undefined) userUpdate.divisionId = input.divisionId || null;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: input.userId },
        data: userUpdate,
      });
    }

    // 5. Also sync UserTerritory primary entry for backward compatibility
    if (input.territoryId || input.hqId) {
      const terrId = input.territoryId || input.hqId!;
      await prisma.userTerritory.deleteMany({ where: { userId: input.userId } });
      await prisma.userTerritory.create({
        data: {
          userId: input.userId,
          territoryId: terrId,
          isPrimary: true,
        },
      });
    }

    // 6. Record EmployeeMovement audit log
    const prevDesc = currentAssignment
      ? `${currentAssignment.hq?.name || 'Unassigned HQ'} (${currentAssignment.territory?.name || 'No Territory'})`
      : 'Unassigned';
    const newDesc = `${newAssignment.hq?.name || 'Unassigned HQ'} (${newAssignment.territory?.name || 'No Territory'})`;

    await prisma.employeeMovement.create({
      data: {
        userId: input.userId,
        movementType: 'TRANSFER',
        effectiveDate,
        previousValue: prevDesc,
        newValue: newDesc,
        reason: input.reason || 'Territory transfer recorded',
        approvedById: input.assignedById || null,
        status: 'APPROVED',
      },
    });

    return newAssignment;
  },

  // ── Employee Movements / Lifecycle Tracking ────────────────────────────────
  async listMovements(query: { userId?: string; movementType?: string; fromDate?: string; toDate?: string }) {
    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.movementType) where.movementType = query.movementType;
    if (query.fromDate || query.toDate) {
      where.effectiveDate = {};
      if (query.fromDate) where.effectiveDate.gte = new Date(query.fromDate);
      if (query.toDate) where.effectiveDate.lte = new Date(query.toDate);
    }

    return prisma.employeeMovement.findMany({
      where,
      orderBy: { effectiveDate: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            role: true,
            designation: true,
            department: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  },

  async createMovement(input: CreateMovementInput) {
    const effectiveDate = input.effectiveDate ? new Date(input.effectiveDate) : new Date();

    const movement = await prisma.employeeMovement.create({
      data: {
        userId: input.userId,
        movementType: input.movementType,
        effectiveDate,
        previousValue: input.previousValue || null,
        newValue: input.newValue || null,
        reason: input.reason || null,
        approvedById: input.approvedById || null,
        supportingDocUrl: input.supportingDocUrl || null,
        status: input.status || 'APPROVED',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // If movement affects employment status (e.g. RESIGNATION, SUSPENSION, CONFIRMATION)
    if (['RESIGNATION', 'TERMINATION', 'RETIRED'].includes(input.movementType)) {
      await prisma.user.update({
        where: { id: input.userId },
        data: {
          employmentStatus: input.movementType,
          isActive: false,
          dateOfExit: effectiveDate,
        },
      });
    } else if (input.movementType === 'SUSPENDED') {
      await prisma.user.update({
        where: { id: input.userId },
        data: { employmentStatus: 'SUSPENDED', isActive: false },
      });
    } else if (input.movementType === 'CONFIRMATION') {
      await prisma.user.update({
        where: { id: input.userId },
        data: {
          employmentType: 'PERMANENT',
          dateOfConfirmation: effectiveDate,
        },
      });
    }

    return movement;
  },
};
