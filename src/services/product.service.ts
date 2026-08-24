import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export const productService = {
  async list(filters: any = {}) {
    const { search, page = 1, limit = 20, category, isActive } = filters;
    const where: Prisma.ProductWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { productCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(category && { category }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    };

    const p = Number(page);
    const l = Number(limit);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.product.findUnique({ where: { id } });
  },

  async create(data: any) {
    const count = await prisma.product.count();
    const productCode = `PROD${String(count + 1).padStart(5, '0')}`;
    
    // Convert string numbers to float for Prisma
    const formattedData = { ...data };
    if (formattedData.unitsInPackage) formattedData.unitsInPackage = parseFloat(formattedData.unitsInPackage);
    if (formattedData.storageTemp) formattedData.storageTemp = parseFloat(formattedData.storageTemp);
    if (formattedData.mrp) formattedData.mrp = parseFloat(formattedData.mrp);
    if (formattedData.ptr) formattedData.ptr = parseFloat(formattedData.ptr);
    if (formattedData.pts) formattedData.pts = parseFloat(formattedData.pts);

    return prisma.product.create({ data: { ...formattedData, productCode } });
  },

  async update(id: string, data: any) {
    const formattedData = { ...data };
    if (formattedData.unitsInPackage !== undefined) formattedData.unitsInPackage = parseFloat(formattedData.unitsInPackage);
    if (formattedData.storageTemp !== undefined) formattedData.storageTemp = parseFloat(formattedData.storageTemp);
    if (formattedData.mrp !== undefined) formattedData.mrp = parseFloat(formattedData.mrp);
    if (formattedData.ptr !== undefined) formattedData.ptr = parseFloat(formattedData.ptr);
    if (formattedData.pts !== undefined) formattedData.pts = parseFloat(formattedData.pts);

    return prisma.product.update({ where: { id }, data: formattedData });
  },

  async deactivate(id: string) {
    return prisma.product.update({ where: { id }, data: { isActive: false } });
  },
};
