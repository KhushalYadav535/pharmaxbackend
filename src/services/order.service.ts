import prisma from '../config/database';

export const orderService = {
  async list(filters: any) {
    const { page = 1, limit = 20, userId, status, retailerId, distributorId, startDate, endDate } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) {
      if (status === 'PENDING' || status === 'SUBMITTED') {
        where.status = 'SUBMITTED';
      } else if (status === 'APPROVED' || status === 'CONFIRMED' || status === 'PROCESSING') {
        where.status = 'PROCESSING';
      } else if (status === 'SHIPPED' || status === 'DISPATCHED') {
        where.status = 'DISPATCHED';
      } else {
        where.status = status;
      }
    }
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
          retailer: { select: { id: true, name: true, city: true } },
          distributor: { select: { id: true, name: true, city: true } },
          visit: {
            select: {
              id: true,
              visitType: true,
              doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
              retailer: { select: { id: true, name: true } },
              distributor: { select: { id: true, name: true } },
            }
          },
          items: {
            include: {
              product: { select: { id: true, name: true, productCode: true, category: true, ptr: true, pts: true, mrp: true } }
            }
          }
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
        user: {
          select: {
            id: true, firstName: true, lastName: true, employeeId: true, phone: true, role: true,
            managerId: true,
            manager: {
              select: { id: true, firstName: true, lastName: true, role: true, phone: true }
            }
          }
        },
        retailer: {
          select: {
            id: true, name: true, address1: true, address2: true, city: true, district: true, state: true,
            pin: true, pincode: true, phone: true, mobileNumber: true, gstNumber: true, drugLicenseNumber: true, ownerName: true
          }
        },
        distributor: {
          select: {
            id: true, name: true, address: true, city: true, state: true, pincode: true,
            phone: true, gstNumber: true, drugLicenseNumber: true, ownerName: true
          }
        },
        visit: {
          select: {
            id: true,
            visitType: true,
            doctor: {
              select: {
                id: true, salutation: true, firstName: true, lastName: true, specialty: true, qualification: true,
                doctorCode: true, phone: true, address1: true, city: true, state: true, pincode: true
              }
            },
            retailer: {
              select: {
                id: true, name: true, address1: true, city: true, state: true, pin: true,
                gstNumber: true, drugLicenseNumber: true, phone: true
              }
            },
            distributor: {
              select: {
                id: true, name: true, address: true, city: true, state: true, pincode: true,
                gstNumber: true, drugLicenseNumber: true, phone: true
              }
            },
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, productCode: true, code: true, category: true,
                ptr: true, pts: true, mrp: true, unit: true, composition: true, unitsInPackage: true
              }
            }
          }
        }
      }
    });
    if (!order) throw new Error('Order not found');
    return order;
  },

  async create(reqUserId: string, data: any) {
    const { 
      userId, hqId, retailerId, distributorId, visitId, orderDate, expectedDeliveryDate,
      totalAmount, discount, notes, items 
    } = data;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    if (!retailerId && !distributorId && !visitId) {
      throw new Error('Order must be associated with either a Retailer, Distributor, or Visit');
    }

    // Auto-generate a readable order number
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    let finalDistributorId: string | null = null;
    let finalNotes = notes || '';

    if (distributorId) {
      const dist = await prisma.distributor.findUnique({ where: { id: distributorId } });
      if (dist) {
        finalDistributorId = dist.id;
      } else {
        // Check if distributorId was pointing to a Stockist
        const stockist = await prisma.stockist.findUnique({ where: { id: distributorId } });
        if (stockist) {
          finalNotes = `[Stockist: ${stockist.name}] ${finalNotes}`.trim();
          const anyDist = await prisma.distributor.findFirst({ where: { isActive: true } });
          finalDistributorId = anyDist?.id || null;
        }
      }
    }

    let finalRetailerId: string | null = null;
    if (retailerId) {
      const ret = await prisma.retailer.findUnique({ where: { id: retailerId } });
      if (ret) finalRetailerId = ret.id;
    }

    let finalVisitId: string | null = null;
    if (visitId) {
      const vis = await prisma.visit.findUnique({ where: { id: visitId } });
      if (vis) finalVisitId = vis.id;
    }

    return prisma.order.create({
      data: {
        orderNumber,
        userId: userId || reqUserId, // Admins can create for others
        hqId: hqId || undefined,
        retailerId: finalRetailerId,
        distributorId: finalDistributorId,
        visitId: finalVisitId,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        totalAmount: data.totalAmount,
        discount: data.discount || 0,
        notes: finalNotes,
        status: 'SUBMITTED',
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

  async updateStatus(id: string, status: any, currentUser?: any) {
    let targetStatus = status;
    if (status === 'APPROVED' || status === 'CONFIRMED') {
      targetStatus = 'PROCESSING';
    } else if (status === 'SHIPPED') {
      targetStatus = 'DISPATCHED';
    } else if (status === 'PENDING') {
      targetStatus = 'SUBMITTED';
    }

    const validStatuses = ['DRAFT', 'SUBMITTED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(targetStatus)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    const existingOrder = await this.getById(id);

    // If changing to PROCESSING (Approved/Confirmed), ensure user is ASM, RSM, ZM, or NSM
    if (targetStatus === 'PROCESSING' && currentUser) {
      const allowedRoles = ['ASM', 'RSM', 'ZM', 'NSM'];
      const isSalesManager = allowedRoles.includes(currentUser.role);
      const isDirectManager = existingOrder.user?.managerId === currentUser.userId;

      if (!isSalesManager && !isDirectManager) {
        throw new Error('Permission denied: Orders can only be approved by field managers (ASM, RSM, ZM, NSM).');
      }
    }
    
    return prisma.order.update({
      where: { id },
      data: { 
        status: targetStatus,
        deliveredAt: targetStatus === 'DELIVERED' ? new Date() : undefined
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
