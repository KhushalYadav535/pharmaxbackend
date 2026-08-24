import { Request, Response } from 'express';
import { stockReportService } from '../services/stockreport.service';

export const stockReportController = {
  async list(req: Request, res: Response) {
    try {
      const data = await stockReportService.list(req.query);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const data = await stockReportService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = await stockReportService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await stockReportService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await stockReportService.delete(req.params.id);
      res.json({ success: true, message: 'Stock Report deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
