import { Request, Response } from 'express';
import { hrmsManagerWorkspaceService } from '../services/hrmsManagerWorkspaceService';

export const hrmsManagerWorkspaceController = {
  async getSnapshot(req: Request, res: Response) {
    try {
      const managerId = req.user!.userId;
      const { date } = req.query;
      const data = await hrmsManagerWorkspaceService.getTeamSnapshot(managerId, date as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getPendingApprovals(req: Request, res: Response) {
    try {
      const managerId = req.user!.userId;
      const data = await hrmsManagerWorkspaceService.getPendingApprovals(managerId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async settleExpense(req: Request, res: Response) {
    try {
      const expenseId = req.params.id as string;
      const settlerId = req.user!.userId;
      const { status, remarks } = req.body;
      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be APPROVED or REJECTED' });
      }
      const data = await hrmsManagerWorkspaceService.settleExpense(expenseId, settlerId, status, remarks);
      res.json({ success: true, data, message: `Expense claim ${status.toLowerCase()} successfully` });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async getMonthlyPerformance(req: Request, res: Response) {
    try {
      const managerId = req.user!.userId;
      const { month } = req.query;
      const data = await hrmsManagerWorkspaceService.getTeamMonthlyPerformance(managerId, month as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
