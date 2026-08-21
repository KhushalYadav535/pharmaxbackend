import { Request, Response } from 'express';
import { locationService } from '../services/location.service';

export const locationController = {
  async list(req: Request, res: Response) {
    try {
      const result = await locationService.list(req.query);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async getById(req: Request, res: Response) {
    try {
      const item = await locationService.getById(req.params.id as string);
      if (!item) return res.status(404).json({ success: false, message: 'Location not found' });
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async create(req: Request, res: Response) {
    try {
      const item = await locationService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async update(req: Request, res: Response) {
    try {
      const item = await locationService.update(req.params.id as string, req.body);
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async deactivate(req: Request, res: Response) {
    try {
      await locationService.deactivate(req.params.id as string);
      res.json({ success: true, message: 'Location deactivated' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
};
