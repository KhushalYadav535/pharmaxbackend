import { Request, Response } from 'express';
import { surveyService } from '../services/survey.service';

export const surveyController = {
  async list(req: Request, res: Response) {
    try {
      const data = await surveyService.list(req.query);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const data = await surveyService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = await surveyService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await surveyService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await surveyService.delete(req.params.id);
      res.json({ success: true, message: 'Survey deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
