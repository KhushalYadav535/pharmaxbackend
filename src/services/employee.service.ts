import prisma from '../config/database';
import bcrypt from 'bcryptjs';

const EMPLOYEE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  employeeId: true,
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
  territories: {
    include: { territory: { select: { id: true, name: true, code: true } } },
  },
} as const;

export const employeeService = {
  async list(filters: any) {
    const { page = 1, limit = 20, search, role, isActive, managerId } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = { deletedAt: null };

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (managerId) where.managerId = managerId;
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

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: string;
    designation?: string;
    department?: string;
    dateOfJoining?: string;
    profilePhoto?: string;
    managerId?: string;
  }) {
    const { password, dateOfJoining, ...rest } = data;
    const passwordHash = await bcrypt.hash(password, 12);

    // Auto-generate employee ID
    const count = await prisma.user.count({ where: { deletedAt: null } });
    const employeeId = `EMP${String(count + 1).padStart(5, '0')}`;

    return prisma.user.create({
      data: {
        ...rest,
        passwordHash,
        employeeId,
        role: rest.role as any,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : undefined,
      },
      select: EMPLOYEE_SELECT,
    });
  },

  async update(id: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    role?: string;
    designation?: string;
    department?: string;
    dateOfJoining?: string;
    profilePhoto?: string;
    managerId?: string;
  }) {
    const { dateOfJoining, ...rest } = data;
    return prisma.user.update({
      where: { id },
      data: {
        ...rest,
        role: rest.role as any,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : undefined,
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
