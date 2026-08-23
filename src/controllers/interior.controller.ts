import { Request, Response } from 'express';
import { interiorService } from '../services/interior.service';

export const interiorController = {
  async list(req: Request, res: Response) {
    try {
      const result = await interiorService.list(req.query);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async getById(req: Request, res: Response) {
    try {
      const item = await interiorService.getById(req.params['id'] as string);
      if (!item) return res.status(404).json({ success: false, message: 'Interior not found' });
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async create(req: Request, res: Response) {
    try {
      const item = await interiorService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async update(req: Request, res: Response) {
    try {
      const item = await interiorService.update(req.params['id'] as string, req.body);
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async deactivate(req: Request, res: Response) {
    try {
      await interiorService.deactivate(req.params['id'] as string);
      res.json({ success: true, message: 'Interior deactivated' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async reactivate(req: Request, res: Response) {
    try {
      await interiorService.reactivate(req.params['id'] as string);
      res.json({ success: true, message: 'Interior reactivated' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async deleteById(req: Request, res: Response) {
    try {
      await interiorService.deleteById(req.params['id'] as string);
      res.json({ success: true, message: 'Interior deleted' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
};
