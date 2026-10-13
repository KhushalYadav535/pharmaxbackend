import { Request, Response } from 'express';
import { hrmsLeaveService } from '../services/hrmsLeaveService';

export const hrmsLeaveController = {
  // ── Leave Types ───────────────────────────────────────────────────────────
  async listTypes(req: Request, res: Response) {
    try {
      const data = await hrmsLeaveService.listLeaveTypes();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createType(req: Request, res: Response) {
    try {
      const data = await hrmsLeaveService.createLeaveType(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async updateType(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const data = await hrmsLeaveService.updateLeaveType(id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // ── Leave Balances ────────────────────────────────────────────────────────
  async getMyBalances(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const data = await hrmsLeaveService.getEmployeeLeaveBalances(userId, year);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getUserBalances(req: Request, res: Response) {
    try {
      const userId = req.params.userId as string;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const data = await hrmsLeaveService.getEmployeeLeaveBalances(userId, year);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── Leave Applications ────────────────────────────────────────────────────
  async applyLeave(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const data = await hrmsLeaveService.applyLeave(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async listLeaves(req: Request, res: Response) {
    try {
      const { status, leaveTypeId, fromDate, toDate, page, limit } = req.query;
      let targetUserId = req.query.userId as string | undefined;
      let targetManagerId = req.query.managerId as string | undefined;

      const userRole = req.user?.role;
      if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(userRole || '')) {
        targetUserId = req.user!.userId;
      } else if (['ASM', 'RSM', 'ZM', 'NSM'].includes(userRole || '')) {
        if (!targetUserId && !targetManagerId) {
          targetManagerId = req.user!.userId;
        }
      }

      const data = await hrmsLeaveService.listLeaves({
        userId: targetUserId,
        managerId: targetManagerId,
        status: status as string,
        leaveTypeId: leaveTypeId as string,
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

  async listMyLeaves(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { status, leaveTypeId, page, limit } = req.query;
      const data = await hrmsLeaveService.listLeaves({
        userId,
        status: status as string,
        leaveTypeId: leaveTypeId as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 30,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async reviewLeave(req: Request, res: Response) {
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

      const data = await hrmsLeaveService.reviewLeave(
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

  async cancelLeave(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;
      const data = await hrmsLeaveService.cancelLeave(id, userId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // ── Holiday Calendar ──────────────────────────────────────────────────────
  async listHolidays(req: Request, res: Response) {
    try {
      const { year, divisionId, state } = req.query;
      const data = await hrmsLeaveService.listHolidays({
        year: year ? parseInt(year as string, 10) : undefined,
        divisionId: divisionId as string,
        state: state as string,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createHoliday(req: Request, res: Response) {
    try {
      const data = await hrmsLeaveService.createHoliday(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async updateHoliday(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const data = await hrmsLeaveService.updateHoliday(id, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async deleteHoliday(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await hrmsLeaveService.deleteHoliday(id);
      res.json({ success: true, message: 'Holiday deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },
};
