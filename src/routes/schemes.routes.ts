import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// ── GET /schemes (List schemes) ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { type, active } = req.query;
    const where: any = {};
    if (active !== 'false') where.isActive = true;
    if (type && type !== 'all') where.type = type;

    const schemes = await prisma.scheme.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });
    res.json({ success: true, data: schemes });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /schemes/:id (Get single scheme) ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const scheme = await prisma.scheme.findUnique({
      where: { id: req.params.id as string },
    });
    if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });
    res.json({ success: true, data: scheme });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /schemes (Create scheme - Admin / Manager) ──────────────────────────
router.post('/', requireManager, async (req, res) => {
  try {
    const { name, description, type, startDate, endDate, targetRole, minPurchase, reward, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Scheme name is required' });
    }

    const scheme = await prisma.scheme.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        type: type || 'free_goods',
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        targetRole: targetRole || 'ALL',
        minPurchase: minPurchase ? parseFloat(minPurchase) : 10,
        reward: reward?.trim() || '10+1 Free Goods',
        isActive: isActive !== false,
      },
    });

    res.status(201).json({ success: true, data: scheme });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PUT /schemes/:id (Update / Edit scheme - Admin / Manager) ─────────────────
router.put('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.scheme.findUnique({ where: { id: id as string } });
    if (!existing) return res.status(404).json({ success: false, message: 'Scheme not found' });

    const { name, description, type, startDate, endDate, targetRole, minPurchase, reward, isActive } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (type !== undefined) data.type = type;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (targetRole !== undefined) data.targetRole = targetRole;
    if (minPurchase !== undefined) data.minPurchase = minPurchase ? parseFloat(minPurchase) : null;
    if (reward !== undefined) data.reward = reward?.trim() || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.scheme.update({
      where: { id: id as string },
      data,
    });

    res.json({ success: true, data: updated, message: 'Scheme updated successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── DELETE /schemes/:id (Delete scheme - Admin / Manager) ────────────────────
router.delete('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.scheme.findUnique({ where: { id: id as string } });
    if (!existing) return res.status(404).json({ success: false, message: 'Scheme not found' });

    await prisma.scheme.delete({
      where: { id: id as string },
    });

    res.json({ success: true, message: 'Scheme deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PATCH /schemes/:id/toggle (Toggle active state) ──────────────────────────
router.patch('/:id/toggle', requireManager, async (req, res) => {
  try {
    const scheme = await prisma.scheme.findUnique({ where: { id: req.params.id as string } });
    if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });
    const updated = await prisma.scheme.update({
      where: { id: req.params.id as string },
      data: { isActive: !scheme.isActive },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
