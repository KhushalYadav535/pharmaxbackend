import prisma from '../config/database';

export interface CreateDocumentInput {
  userId: string;
  category: string;
  title: string;
  documentNumber?: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  issueDate?: string | Date;
  expiryDate?: string | Date;
  isConfidential?: boolean;
  notes?: string;
  uploadedById?: string;
}

export const hrmsDocumentService = {
  async listDocuments(filter: {
    userId?: string;
    category?: string;
    status?: string;
    expiringDays?: number;
    search?: string;
  }) {
    const where: any = {};

    if (filter.userId) {
      where.userId = filter.userId;
    }
    if (filter.category) {
      where.category = filter.category;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.expiringDays) {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + filter.expiringDays);
      where.expiryDate = {
        gte: now,
        lte: future,
      };
    }
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { documentNumber: { contains: filter.search, mode: 'insensitive' } },
        { user: { firstName: { contains: filter.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: filter.search, mode: 'insensitive' } } },
        { user: { employeeId: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }

    return prisma.employeeDocument.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            role: true,
            department: true,
            designation: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getDocumentById(id: string) {
    const doc = await prisma.employeeDocument.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            phone: true,
            designation: true,
            department: true,
          },
        },
        verifiedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!doc) throw new Error('Document not found');
    return doc;
  },

  async createDocument(data: CreateDocumentInput) {
    if (!data.userId || !data.category || !data.title || !data.fileUrl) {
      throw new Error('User, category, title, and fileUrl are required');
    }

    return prisma.employeeDocument.create({
      data: {
        userId: data.userId,
        category: data.category,
        title: data.title,
        documentNumber: data.documentNumber,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        isConfidential: !!data.isConfidential,
        notes: data.notes,
        uploadedById: data.uploadedById,
        status: 'VERIFIED', // Default verified for admin/HR uploads
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, employeeId: true },
        },
      },
    });
  },

  async verifyDocument(id: string, verifierId: string, status: 'VERIFIED' | 'REJECTED', notes?: string) {
    const doc = await prisma.employeeDocument.findUnique({ where: { id } });
    if (!doc) throw new Error('Document not found');

    return prisma.employeeDocument.update({
      where: { id },
      data: {
        status,
        verifiedById: verifierId,
        verifiedAt: new Date(),
        notes: notes || doc.notes,
      },
    });
  },

  async deleteDocument(id: string) {
    return prisma.employeeDocument.delete({
      where: { id },
    });
  },

  async getDocumentStats() {
    const total = await prisma.employeeDocument.count();
    const verified = await prisma.employeeDocument.count({ where: { status: 'VERIFIED' } });
    const pending = await prisma.employeeDocument.count({ where: { status: 'PENDING' } });

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const expired = await prisma.employeeDocument.count({
      where: {
        expiryDate: { lt: now },
      },
    });

    const expiringSoon = await prisma.employeeDocument.count({
      where: {
        expiryDate: {
          gte: now,
          lte: in30Days,
        },
      },
    });

    const byCategory = await prisma.employeeDocument.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    return {
      total,
      verified,
      pending,
      expired,
      expiringSoon,
      byCategory: byCategory.map((c) => ({ category: c.category, count: c._count.id })),
    };
  },
};
