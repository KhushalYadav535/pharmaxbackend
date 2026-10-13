import { Request, Response } from 'express';
import { hrmsReportingService } from '../services/hrms-reporting.service';

export const hrmsReportingController = {
  async getReportingTree(req: Request, res: Response) {
    try {
      const data = await hrmsReportingService.getReportingTree();
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async getTeamHierarchy(req: Request, res: Response) {
    try {
      const managerId = (req.params.managerId as string) || req.user?.userId;
      if (!managerId) return res.status(400).json({ success: false, message: 'managerId required' });
      const data = await hrmsReportingService.getTeamHierarchy(managerId);
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },
};
