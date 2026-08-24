import prisma from '../config/database';

export const taskService = {
  async list(filters: any) {
    const { page = 1, limit = 20, assignedToId, status, priority, type } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (assignedToId) where.assignedToId = assignedToId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.type = type;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } }
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { dueDate: 'asc' } // Closest due dates first
      }),
      prisma.task.count({ where })
    ]);

    return { tasks, total, page: p, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    if (!task) throw new Error('Task not found');
    return task;
  },

  async create(reqUserId: string, data: any) {
    const { 
      title, type, priority, assignedToId,
      dueDate, notes 
    } = data;
    
    if (!title) {
      throw new Error('Task title is required');
    }

    return prisma.task.create({
      data: {
        title,
        type: type || 'TODO',
        priority: priority || 'MEDIUM',
        createdById: reqUserId,
        assignedToId: assignedToId || reqUserId, // Self-assign if empty
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        status: 'NOT_STARTED',
        ownerAssignedDate: new Date()
      }
    });
  },

  async update(id: string, data: any) {
    await this.getById(id);
    
    const { 
      title, type, priority, assignedToId,
      dueDate, notes, status 
    } = data;

    let completionDate = undefined;
    if (status === 'COMPLETED') {
      completionDate = new Date();
    } else if (status) {
      completionDate = null;
    }

    return prisma.task.update({
      where: { id },
      data: {
        title,
        type,
        priority,
        assignedToId,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        notes,
        status,
        completionDate
      }
    });
  },

  async updateStatus(id: string, status: any) {
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    await this.getById(id);
    
    return prisma.task.update({
      where: { id },
      data: { 
        status,
        completionDate: status === 'COMPLETED' ? new Date() : null
      }
    });
  },

  async delete(id: string) {
    await this.getById(id);
    return prisma.task.delete({ where: { id } });
  }
};
