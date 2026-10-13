import prisma from '../config/database';

export const hrmsOrgService = {
  // ── Departments ────────────────────────────────────────────────────────────
  async listDepartments() {
    return prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        head: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        _count: { select: { employees: true, designations: true } },
      },
    });
  },

  async getDepartmentById(id: string) {
    return prisma.department.findUnique({
      where: { id },
      include: {
        head: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        employees: { select: { id: true, firstName: true, lastName: true, employeeId: true, role: true } },
        designations: true,
      },
    });
  },

  async createDepartment(data: { name: string; code: string; headId?: string; status?: boolean; effectiveDate?: Date }) {
    return prisma.department.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        headId: data.headId || null,
        status: data.status !== undefined ? data.status : true,
        effectiveDate: data.effectiveDate || new Date(),
      },
    });
  },

  async updateDepartment(id: string, data: { name?: string; code?: string; headId?: string | null; status?: boolean }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase();
    if (data.headId !== undefined) updateData.headId = data.headId || null;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.department.update({
      where: { id },
      data: updateData,
    });
  },

  async deleteDepartment(id: string) {
    // Check if any employees attached
    const count = await prisma.user.count({ where: { departmentId: id } });
    if (count > 0) {
      throw new Error(`Cannot delete department with ${count} active employees. Reassign them first.`);
    }
    return prisma.department.delete({ where: { id } });
  },

  // ── Divisions ──────────────────────────────────────────────────────────────
  async listDivisions() {
    return prisma.division.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { employees: true, assignments: true } },
      },
    });
  },

  async createDivision(data: { name: string; code: string; businessUnit?: string; status?: boolean }) {
    return prisma.division.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        businessUnit: data.businessUnit || null,
        status: data.status !== undefined ? data.status : true,
      },
    });
  },

  async updateDivision(id: string, data: { name?: string; code?: string; businessUnit?: string; status?: boolean }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase();
    if (data.businessUnit !== undefined) updateData.businessUnit = data.businessUnit || null;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.division.update({
      where: { id },
      data: updateData,
    });
  },

  async deleteDivision(id: string) {
    const count = await prisma.user.count({ where: { divisionId: id } });
    if (count > 0) {
      throw new Error(`Cannot delete division with ${count} assigned employees.`);
    }
    return prisma.division.delete({ where: { id } });
  },

  // ── Grade Bands ────────────────────────────────────────────────────────────
  async listGradeBands() {
    return prisma.gradeBand.findMany({
      orderBy: { level: 'asc' },
      include: {
        _count: { select: { employees: true, designations: true } },
      },
    });
  },

  async createGradeBand(data: { name: string; code: string; level?: number; description?: string; status?: boolean }) {
    return prisma.gradeBand.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        level: data.level || 1,
        description: data.description || null,
        status: data.status !== undefined ? data.status : true,
      },
    });
  },

  async updateGradeBand(id: string, data: { name?: string; code?: string; level?: number; description?: string; status?: boolean }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase();
    if (data.level !== undefined) updateData.level = data.level;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.gradeBand.update({
      where: { id },
      data: updateData,
    });
  },

  async deleteGradeBand(id: string) {
    const count = await prisma.user.count({ where: { gradeBandId: id } });
    if (count > 0) {
      throw new Error(`Cannot delete grade band with ${count} assigned employees.`);
    }
    return prisma.gradeBand.delete({ where: { id } });
  },

  // ── Designations ───────────────────────────────────────────────────────────
  async listDesignations() {
    return prisma.designation.findMany({
      orderBy: { name: 'asc' },
      include: {
        gradeBand: true,
        department: true,
        _count: { select: { employees: true } },
      },
    });
  },

  async createDesignation(data: { name: string; code: string; gradeBandId?: string; departmentId?: string; status?: boolean }) {
    return prisma.designation.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        gradeBandId: data.gradeBandId || null,
        departmentId: data.departmentId || null,
        status: data.status !== undefined ? data.status : true,
      },
      include: { gradeBand: true, department: true },
    });
  },

  async updateDesignation(id: string, data: { name?: string; code?: string; gradeBandId?: string | null; departmentId?: string | null; status?: boolean }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase();
    if (data.gradeBandId !== undefined) updateData.gradeBandId = data.gradeBandId || null;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.designation.update({
      where: { id },
      data: updateData,
      include: { gradeBand: true, department: true },
    });
  },

  async deleteDesignation(id: string) {
    const count = await prisma.user.count({ where: { designationId: id } });
    if (count > 0) {
      throw new Error(`Cannot delete designation assigned to ${count} employees.`);
    }
    return prisma.designation.delete({ where: { id } });
  },

  // ── HRMS Settings & Approval Policies ──────────────────────────────────────
  async getAllSettings() {
    return prisma.hRMSSetting.findMany({
      orderBy: { key: 'asc' },
    });
  },

  async getSetting(key: string) {
    return prisma.hRMSSetting.findUnique({
      where: { key },
    });
  },

  async updateSetting(key: string, value: string, description?: string, updatedBy?: string) {
    return prisma.hRMSSetting.upsert({
      where: { key },
      update: {
        value,
        description: description || undefined,
        updatedBy: updatedBy || undefined,
        updatedAt: new Date(),
      },
      create: {
        key,
        value,
        description,
        updatedBy,
      },
    });
  },
};
