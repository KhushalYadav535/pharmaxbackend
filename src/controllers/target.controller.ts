import { Request, Response } from 'express';
import { targetService } from '../services/target.service';

export const targetController = {
  async list(req: Request, res: Response) {
    try {
      const data = await targetService.list(req.query);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const data = await targetService.getById(req.params.id as string);
      if (!data) return res.status(404).json({ success: false, message: 'Target not found' });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = await targetService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await targetService.update(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await targetService.delete(req.params.id as string);
      res.json({ success: true, message: 'Target deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
