import { Request, Response } from 'express';
import { dailyReportService } from '../services/dailyreport.service';

export const dailyReportController = {
  async list(req: Request, res: Response) {
    try {
      const result = await dailyReportService.list(req.query, req.user!.userId, req.user!.role);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async getById(req: Request, res: Response) {
    try {
      const item = await dailyReportService.getById(req.params.id as string);
      if (!item) return res.status(404).json({ success: false, message: 'Daily report not found' });
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async create(req: Request, res: Response) {
    try {
      const item = await dailyReportService.create(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async update(req: Request, res: Response) {
    try {
      const item = await dailyReportService.update(req.params.id as string, req.body);
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
};
