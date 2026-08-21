import { Request, Response } from 'express';
import { stockReportService } from '../services/stockreport.service';

export const stockReportController = {
  async list(req: Request, res: Response) {
    try {
      const result = await stockReportService.list(req.query);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async getById(req: Request, res: Response) {
    try {
      const item = await stockReportService.getById(req.params.id as string);
      if (!item) return res.status(404).json({ success: false, message: 'Stock report not found' });
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async create(req: Request, res: Response) {
    try {
      const item = await stockReportService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async update(req: Request, res: Response) {
    try {
      const item = await stockReportService.update(req.params.id as string, req.body);
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
};
