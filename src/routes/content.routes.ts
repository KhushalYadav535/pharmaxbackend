import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// List contents
router.get('/', async (req, res) => {
  try {
    const { search, type, campaignId } = req.query;
    const where: any = { isActive: true, isDisabled: false };
    if (search) where.title = { contains: search as string, mode: 'insensitive' };
    if (type) where.contentType = type;
    if (campaignId) where.campaignId = campaignId;

    const contents = await prisma.content.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true } },
        _count: { select: { views: true } },
      },
    });
    res.json({ success: true, data: contents });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Single content
router.get('/:id', async (req, res) => {
  try {
    const content = await prisma.content.findUnique({
      where: { id: req.params.id as string },
      include: { campaign: true, _count: { select: { views: true } } },
    });
    if (!content) return res.status(404).json({ success: false, message: 'Content not found' });

    // Log view
    await prisma.contentView.create({
      data: { contentId: req.params.id as string, userId: req.user!.userId },
    });

    res.json({ success: true, data: content });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Create content (manager/admin)
router.post('/', requireManager, async (req, res) => {
  try {
    const content = await prisma.content.create({ data: req.body });
    res.status(201).json({ success: true, data: content });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Toggle disable content (admin)
router.patch('/:id/toggle', requireManager, async (req, res) => {
  try {
    const content = await prisma.content.findUnique({ where: { id: req.params.id as string } });
    if (!content) return res.status(404).json({ success: false, message: 'Not found' });
    const updated = await prisma.content.update({
      where: { id: req.params.id as string },
      data: { isDisabled: !content.isDisabled },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Campaigns
router.get('/campaigns/list', async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { isActive: true },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { contents: true } } },
    });
    res.json({ success: true, data: campaigns });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/campaigns', requireManager, async (req, res) => {
  try {
    const campaign = await prisma.campaign.create({ data: req.body });
    res.status(201).json({ success: true, data: campaign });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
