import { Request, Response } from 'express';
import { tourPlanService } from '../services/tourplan.service';

export const tourPlanController = {
  async list(req: Request, res: Response) {
    try {
      const data = await tourPlanService.list(req.query);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const data = await tourPlanService.getById(req.params.id as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      // req.user from auth middleware
      const userId = (req as any).user?.userId;
      const data = await tourPlanService.create(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await tourPlanService.update(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const data = await tourPlanService.updateStatus(req.params.id as string, req.body.status);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await tourPlanService.delete(req.params.id as string);
      res.json({ success: true, message: 'Tour Plan deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
