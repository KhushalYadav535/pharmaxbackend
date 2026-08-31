import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { contentUpload } from '../middlewares/upload.middleware';
import { env } from '../config/env';
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

// Single content (logs view)
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

// Upload file + create content record (manager/admin)
router.post('/upload', requireManager, contentUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { title, description, contentType, productName, campaignId, version, thumbnailUrl } = req.body;

    if (!title || !contentType) {
      // Clean up the uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'title and contentType are required' });
    }

    // Store relative URL path that the static server will resolve
    const fileUrl = `/uploads/content/${req.file.filename}`;

    const data: any = {
      title,
      contentType,
      fileUrl,
      description: description || null,
      productName: productName || null,
      version: version || '1.0',
      thumbnailUrl: thumbnailUrl || null,
    };
    if (campaignId) data.campaignId = campaignId;

    const content = await prisma.content.create({ data });
    res.status(201).json({ success: true, data: content });
  } catch (err: any) {
    // Remove file if DB insert fails
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

// Create content with external URL (manager/admin) — kept for backwards compat
router.post('/', requireManager, async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.campaignId) delete data.campaignId;
    const content = await prisma.content.create({ data });
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

// Delete content + file (admin)
router.delete('/:id', requireManager, async (req, res) => {
  try {
    const content = await prisma.content.findUnique({ where: { id: req.params.id as string } });
    if (!content) return res.status(404).json({ success: false, message: 'Not found' });

    // Soft-delete from DB first
    await prisma.content.update({
      where: { id: req.params.id as string },
      data: { isActive: false },
    });

    // Delete physical file if it's a locally uploaded file
    if (content.fileUrl.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), env.UPLOAD_DIR, 'content', path.basename(content.fileUrl));
      try { fs.unlinkSync(filePath); } catch (_) {}
    }

    res.json({ success: true, message: 'Content deleted' });
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
