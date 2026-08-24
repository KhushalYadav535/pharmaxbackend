import { Request, Response } from 'express';
import { headquarterService } from '../services/headquarter.service';

export const headquarterController = {
  async list(req: Request, res: Response) {
    try {
      const result = await headquarterService.list(req.query);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async getById(req: Request, res: Response) {
    try {
      const item = await headquarterService.getById(req.params['id'] as string);
      if (!item) return res.status(404).json({ success: false, message: 'Headquarter not found' });
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, state } = req.body;
      if (!name || !state) {
        return res.status(400).json({ success: false, message: 'name and state are required' });
      }
      const item = await headquarterService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({ success: false, message: 'Headquarter code already exists' });
      }
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await headquarterService.update(req.params['id'] as string, req.body);
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async toggleActive(req: Request, res: Response) {
    try {
      // Territory has no isActive field — we use a workaround approach if needed
      // For now we support soft logic via parentId being null = active
      res.json({ success: true, message: 'Toggle not applicable for HQ' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async deleteById(req: Request, res: Response) {
    try {
      await headquarterService.deleteById(req.params['id'] as string);
      res.json({ success: true, message: 'Headquarter deleted' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
};
