import { Request, Response } from 'express';
import { hrmsAttendanceService } from '../services/hrmsAttendanceService';

export const hrmsAttendanceController = {
  // GET /api/v1/hrms/attendance/register
  async getRegister(req: Request, res: Response) {
    try {
      const { fromDate, toDate, departmentId, divisionId, status, page, limit } = req.query;
      let targetUserId = req.query.userId as string | undefined;
      let targetManagerId = req.query.managerId as string | undefined;

      const userRole = req.user?.role;
      // Field employees (MRs) can only query their own attendance
      if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(userRole || '')) {
        targetUserId = req.user!.userId;
      } else if (['ASM', 'RSM', 'ZM', 'NSM'].includes(userRole || '')) {
        // Managers default to their team if no specific filter is provided
        if (!targetUserId && !targetManagerId) {
          targetManagerId = req.user!.userId;
        }
      }

      const data = await hrmsAttendanceService.getAttendanceRegister({
        fromDate: fromDate as string,
        toDate: toDate as string,
        departmentId: departmentId as string,
        divisionId: divisionId as string,
        userId: targetUserId,
        managerId: targetManagerId,
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 30,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/v1/hrms/attendance/exceptions
  async getExceptions(req: Request, res: Response) {
    try {
      const { fromDate, toDate, departmentId, divisionId } = req.query;
      const data = await hrmsAttendanceService.getAttendanceExceptions({
        fromDate: fromDate as string,
        toDate: toDate as string,
        departmentId: departmentId as string,
        divisionId: divisionId as string,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/v1/hrms/attendance/my-summary
  async getMySummary(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { month } = req.query;
      const data = await hrmsAttendanceService.getEmployeeAttendanceSummary(userId, month as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/v1/hrms/attendance/user/:userId/summary
  async getUserSummary(req: Request, res: Response) {
    try {
      const userId = req.params.userId as string;
      const { month } = req.query;
      const data = await hrmsAttendanceService.getEmployeeAttendanceSummary(userId, month as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/v1/hrms/attendance/regularizations
  async requestRegularization(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const data = await hrmsAttendanceService.createRegularization(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // GET /api/v1/hrms/attendance/regularizations
  async listRegularizations(req: Request, res: Response) {
    try {
      const { userId, managerId, status, fromDate, toDate, page, limit } = req.query;
      const data = await hrmsAttendanceService.listRegularizations({
        userId: userId as string,
        managerId: managerId as string,
        status: status as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 30,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/v1/hrms/attendance/my-regularizations
  async listMyRegularizations(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { status, page, limit } = req.query;
      const data = await hrmsAttendanceService.listRegularizations({
        userId,
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 30,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST or PATCH /api/v1/hrms/attendance/regularizations/:id/review
  async reviewRegularization(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      let rawAction = req.body.action || req.body.status;
      if (rawAction === 'APPROVED') rawAction = 'APPROVE';
      if (rawAction === 'REJECTED') rawAction = 'REJECT';
      const remarks = req.body.remarks || req.body.managerRemarks || req.body.rejectionReason;
      const reviewerId = req.user!.userId;
      const reviewerRole = req.user!.role;

      if (!['APPROVE', 'REJECT'].includes(rawAction)) {
        return res.status(400).json({ success: false, message: 'Invalid action. Must be APPROVE or REJECT.' });
      }

      const data = await hrmsAttendanceService.reviewRegularization(
        id,
        reviewerId,
        reviewerRole,
        rawAction,
        remarks
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },
};
