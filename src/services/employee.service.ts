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

    return { employees, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: EMPLOYEE_SELECT,
    });
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
