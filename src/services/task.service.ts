import prisma from '../config/database';
import { TaskStatus } from '@prisma/client';

export const taskService = {
  async list(filters: any, userId: string) {
    const { page = 1, limit = 20, status, type, priority, assignedToId } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;
    // Default: show tasks created by or assigned to this user
    if (!assignedToId) {
      where.OR = [{ assignedToId: userId }, { createdById: userId }];
    }
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { dueDate: 'asc' },
      }),
      prisma.task.count({ where }),
    ]);
    return { tasks, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: { assignedTo: true, createdBy: true },
    });
  },

  async create(data: {
    title: string;
    type?: any;
    priority?: any;
    assignedToId?: string;
    queue?: string;
    dueDate?: string;
    reminder?: string;
    notes?: string;
  }, createdById: string) {
    return prisma.task.create({
      data: {
        ...data,
        createdById,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  },

  async update(id: string, data: any) {
    if (data.status === 'COMPLETED' && !data.completionDate) {
      data.completionDate = new Date();
    }
    return prisma.task.update({ where: { id }, data });
  },

  async complete(id: string) {
    return prisma.task.update({
      where: { id },
      data: { status: TaskStatus.COMPLETED, completionDate: new Date() },
    });
  },
};
