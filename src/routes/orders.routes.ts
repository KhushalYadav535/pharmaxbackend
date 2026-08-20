import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const p = parseInt(page as string); const l = parseInt(limit as string);
    const where: any = {
      userId: req.user!.userId,
      ...(status && { status }),
    };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, include: { retailer: { select: { id: true, name: true } }, distributor: { select: { id: true, name: true } }, items: { include: { product: true } } }, skip: (p - 1) * l, take: l, orderBy: { createdAt: 'desc' } }),
      prisma.order.count({ where }),
    ]);
    res.json({ success: true, data: { orders, total, page: p, totalPages: Math.ceil(total / l) } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: { include: { product: true } }, retailer: true, distributor: true, user: { select: { id: true, firstName: true, lastName: true } } } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auditLog('CREATE', 'Order'), async (req, res) => {
  try {
    const { items, ...orderData } = req.body;
    
    const processedItems = [];
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.productName) {
          let product = await prisma.product.findFirst({
            where: { name: { equals: item.productName, mode: 'insensitive' } }
          });
          
          if (!product) {
            product = await prisma.product.create({
              data: {
                name: item.productName,
                code: 'PRD-' + Date.now() + Math.floor(Math.random() * 1000),
                mrp: Number(item.unitPrice) || 0,
                ptr: Number(item.unitPrice) || 0,
                pts: Number(item.unitPrice) || 0,
              }
            });
          }
          
          processedItems.push({
            productId: product.id,
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || 0,
          });
        }
      }
    }

    const total = processedItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const order = await prisma.order.create({
      data: { ...orderData, userId: req.user!.userId, totalAmount: total, items: { create: processedItems } },
      include: { items: { include: { product: true } } },
    });
    res.status(201).json({ success: true, data: order });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/:id/status', auditLog('UPDATE', 'Order'), async (req, res) => {
  try {
    const order = await prisma.order.update({ where: { id: req.params.id as string }, data: { status: req.body.status } });
    res.json({ success: true, data: order });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
