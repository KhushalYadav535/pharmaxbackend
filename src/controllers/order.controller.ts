import { Request, Response } from 'express';
import { orderService } from '../services/order.service';

export const orderController = {
  async list(req: Request, res: Response) {
    try {
      const data = await orderService.list(req.query);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const data = await orderService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const data = await orderService.create(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      const data = await orderService.updateStatus(req.params.id, status);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await orderService.delete(req.params.id);
      res.json({ success: true, message: 'Order deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
