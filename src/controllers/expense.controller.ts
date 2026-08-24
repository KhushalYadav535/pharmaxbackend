import { Request, Response } from 'express';
import { expenseService } from '../services/expense.service';

export const expenseController = {
  async list(req: Request, res: Response) {
    try {
      const data = await expenseService.list(req.query);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const data = await expenseService.getById(req.params.id as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const data = await expenseService.create(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await expenseService.update(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { status, reason } = req.body;
      const data = await expenseService.updateStatus(req.params.id as string, status, reason);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await expenseService.delete(req.params.id as string);
      res.json({ success: true, message: 'Expense deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
