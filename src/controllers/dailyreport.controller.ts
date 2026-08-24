import { Request, Response } from 'express';
import { dailyReportService } from '../services/dailyreport.service';

export const dailyReportController = {
  async list(req: Request, res: Response) {
    try {
      const data = await dailyReportService.list(req.query);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const data = await dailyReportService.getById(req.params.id as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const data = await dailyReportService.create(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await dailyReportService.update(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await dailyReportService.delete(req.params.id as string);
      res.json({ success: true, message: 'Daily Report deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
