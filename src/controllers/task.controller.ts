import { Request, Response } from 'express';
import { taskService } from '../services/task.service';

export const taskController = {
  async list(req: Request, res: Response) {
    try {
      const result = await taskService.list(req.query, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async getById(req: Request, res: Response) {
    try {
      const item = await taskService.getById(req.params.id as string);
      if (!item) return res.status(404).json({ success: false, message: 'Task not found' });
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
  async create(req: Request, res: Response) {
    try {
      const item = await taskService.create(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async update(req: Request, res: Response) {
    try {
      const item = await taskService.update(req.params.id as string, req.body);
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
  async complete(req: Request, res: Response) {
    try {
      const item = await taskService.complete(req.params.id as string);
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
};
