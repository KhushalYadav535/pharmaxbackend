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
    if (type) {
      if (type === 'PRESENTATION') {
        where.contentType = { in: ['PRESENTATION', 'IMAGE'] };
      } else {
        where.contentType = type;
      }
    }
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

// ── Dynamic Detailing Categories & Product Mapping Endpoints ────────────────

// List all active Detailing Categories
router.get('/categories', async (req, res) => {
  try {
    const categories: any = await prisma.$queryRawUnsafe(`
      SELECT id, name, code, description, "productNames", "doctorKeywords", color, "isActive", "createdAt", "updatedAt"
      FROM detailing_categories
      WHERE "isActive" = true
      ORDER BY name ASC
    `);
    res.json({ success: true, data: categories });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new Detailing Category
router.post('/categories', async (req, res) => {
  try {
    const { name, code, description, productNames = [], doctorKeywords = [], color = '#059669' } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const generatedCode = (code || name).toUpperCase().replace(/[^A-Z0-9]/g, '_');

    // Generate doctorKeywords from name if empty
    const keywords = doctorKeywords.length > 0
      ? doctorKeywords
      : [name.toLowerCase(), ...name.toLowerCase().split(/\s+/)].filter((w: string) => w.length > 2);

    await prisma.$executeRawUnsafe(
      `INSERT INTO detailing_categories (id, name, code, description, "productNames", "doctorKeywords", color, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
      id,
      name.trim(),
      generatedCode,
      description || null,
      productNames,
      keywords,
      color
    );

    const created: any = await prisma.$queryRawUnsafe(
      `SELECT * FROM detailing_categories WHERE id = $1`,
      id
    );

    res.status(201).json({ success: true, data: created[0] });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Update Detailing Category / Product Mappings
router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, productNames, doctorKeywords, color } = req.body;

    const existing: any = await prisma.$queryRawUnsafe(
      `SELECT * FROM detailing_categories WHERE id = $1`,
      id
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const current = existing[0];
    const newName = name !== undefined ? name.trim() : current.name;
    const newDesc = description !== undefined ? description : current.description;
    const newProds = productNames !== undefined ? productNames : current.productNames;
    const newKeywords = doctorKeywords !== undefined ? doctorKeywords : current.doctorKeywords;
    const newColor = color !== undefined ? color : current.color;

    await prisma.$executeRawUnsafe(
      `UPDATE detailing_categories 
       SET name = $1, description = $2, "productNames" = $3, "doctorKeywords" = $4, color = $5, "updatedAt" = NOW()
       WHERE id = $6`,
      newName,
      newDesc,
      newProds,
      newKeywords,
      newColor,
      id
    );

    const updated: any = await prisma.$queryRawUnsafe(
      `SELECT * FROM detailing_categories WHERE id = $1`,
      id
    );

    res.json({ success: true, data: updated[0] });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Delete (deactivate) Detailing Category
router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.$executeRawUnsafe(
      `UPDATE detailing_categories SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1`,
      id
    );
    res.json({ success: true, message: 'Category deleted' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
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
