import { Request, Response } from 'express';
import { aiService } from '../services/ai.service';

export const aiController = {
  async summarizeVisit(req: Request, res: Response) {
    try {
      const summary = await aiService.summarizeVisit(req.body);
      res.json({ success: true, data: { summary } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async nextBestAction(req: Request, res: Response) {
    try {
      const actions = await aiService.nextBestAction(req.body);
      res.json({ success: true, data: { actions } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async chat(req: Request, res: Response) {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ success: false, message: 'messages array required' });
      }
      const reply = await aiService.chat(messages, req.user!.role);
      res.json({ success: true, data: { reply } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async dailyPlan(req: Request, res: Response) {
    try {
      const plan = await aiService.generateDailyPlan(req.body);
      res.json({ success: true, data: { plan } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async eodReport(req: Request, res: Response) {
    try {
      const report = await aiService.generateEODReport(req.body.visits || []);
      res.json({ success: true, data: { report } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
