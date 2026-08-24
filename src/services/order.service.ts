import prisma from '../config/database';

export const orderService = {
  async list(filters: any) {
    const { page = 1, limit = 20, userId, status, retailerId, distributorId, startDate, endDate } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (retailerId) where.retailerId = retailerId;
    if (distributorId) where.distributorId = distributorId;

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate);
      if (endDate) where.orderDate.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          retailer: { select: { id: true, name: true } },
          distributor: { select: { id: true, name: true } },
          items: true
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { orderDate: 'desc' }
      }),
      prisma.order.count({ where })
    ]);

    return { orders, total, page: p, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        retailer: { select: { id: true, name: true, address1: true, city: true, mobileNumber: true } },
        distributor: { select: { id: true, name: true, address1: true, city: true, mobileNumber: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, productCode: true, category: true } }
          }
        }
      }
    });
    if (!order) throw new Error('Order not found');
    return order;
  },

  async create(reqUserId: string, data: any) {
    const { 
      userId, hqId, retailerId, distributorId, orderDate, expectedDeliveryDate,
      totalAmount, discount, notes, items 
    } = data;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    if (!retailerId && !distributorId) {
      throw new Error('Order must be associated with either a Retailer or a Distributor');
    }

    // Auto-generate a readable order number
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    return prisma.order.create({
      data: {
        orderNumber,
        userId: userId || reqUserId, // Admins can create for others
        hqId,
        retailerId,
        distributorId,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        totalAmount: Number(totalAmount || 0),
        discount: Number(discount || 0),
        notes,
        status: 'PENDING',
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: Number(item.quantity || 1),
            productScheme: item.productScheme || null,
            unitPrice: Number(item.unitPrice || 0),
            discount: Number(item.discount || 0),
            totalPrice: Number(item.totalPrice || 0)
          }))
        }
      },
      include: { items: true }
    });
  },

  async updateStatus(id: string, status: any) {
    const validStatuses = ['DRAFT', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    await this.getById(id);
    
    return prisma.order.update({
      where: { id },
      data: { 
        status,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined
      }
    });
  },

  async delete(id: string) {
    await this.getById(id);
    
    // Prisma cascading delete doesn't automatically happen unless configured in schema.
    // We will manually delete items first, then the order in a transaction.
    return prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      return tx.order.delete({ where: { id } });
    });
  }
};
