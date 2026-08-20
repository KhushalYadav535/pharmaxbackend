import { Request, Response } from 'express';
import { visitService } from '../services/visit.service';

export const visitController = {
  async list(req: Request, res: Response) {
    try {
      const result = await visitService.list(req.query, req.user!.userId, req.user!.role);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const visit = await visitService.getById(req.params.id as string);
      if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const visit = await visitService.create(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async checkIn(req: Request, res: Response) {
    try {
      const visit = await visitService.checkIn(req.params.id as string, req.body);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async checkOut(req: Request, res: Response) {
    try {
      const visit = await visitService.checkOut(req.params.id as string, req.body);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async approve(req: Request, res: Response) {
    try {
      const visit = await visitService.approve(req.params.id as string, req.user!.userId);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async reject(req: Request, res: Response) {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason required' });
      const visit = await visitService.reject(req.params.id as string, req.user!.userId, reason);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async todayStats(req: Request, res: Response) {
    try {
      const stats = await visitService.getTodayStats(req.user!.userId);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
