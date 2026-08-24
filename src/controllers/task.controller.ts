import { Request, Response } from 'express';
import { taskService } from '../services/task.service';

export const taskController = {
  async list(req: Request, res: Response) {
    try {
      const data = await taskService.list(req.query);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const data = await taskService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const data = await taskService.create(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await taskService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      const data = await taskService.updateStatus(req.params.id, status);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await taskService.delete(req.params.id);
      res.json({ success: true, message: 'Task deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
