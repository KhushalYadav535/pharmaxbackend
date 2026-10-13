import { Request, Response } from 'express';
import { hrmsIncentiveService } from '../services/hrmsIncentiveService';

export const hrmsIncentiveController = {
  // Plans
  async listPlans(_req: Request, res: Response) {
    try {
      const data = await hrmsIncentiveService.listIncentivePlans();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createPlan(req: Request, res: Response) {
    try {
      const data = await hrmsIncentiveService.createIncentivePlan(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async updatePlan(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const data = await hrmsIncentiveService.updateIncentivePlan(id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // Calculations
  async listCalculations(req: Request, res: Response) {
    try {
      const { period, userId, planId, status } = req.query;
      const data = await hrmsIncentiveService.listCalculations({
        period: period as string,
        userId: userId as string,
        planId: planId as string,
        status: status as string,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getMyCalculations(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { period } = req.query;
      const data = await hrmsIncentiveService.listCalculations({
        userId,
        period: period as string,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async runCalculation(req: Request, res: Response) {
    try {
      const { period, planId } = req.body;
      if (!period) {
        return res.status(400).json({ success: false, message: 'Period (e.g. 2026-10) is required' });
      }
      const data = await hrmsIncentiveService.runBatchCalculations(period, planId);
      res.json({ success: true, data, message: 'Incentive calculation completed successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const approverId = req.user!.userId;
      const { status, notes } = req.body;
      const data = await hrmsIncentiveService.updateStatus(id, approverId, status, notes);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async getSummary(req: Request, res: Response) {
    try {
      const { period } = req.query;
      const data = await hrmsIncentiveService.getIncentiveSummary(period as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
