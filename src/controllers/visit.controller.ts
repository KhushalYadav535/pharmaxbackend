import { Request, Response } from 'express';
import { visitService } from '../services/visit.service';

export const visitController = {
  async list(req: Request, res: Response) {
    try {
      const result = await visitService.list(req.query, req.user!.userId, req.user!.role);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async listTeam(req: Request, res: Response) {
    try {
      const result = await visitService.listTeam(req.query, req.user!.userId, req.user!.role);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.message === 'Access denied' ? 403 : 500).json({ success: false, message: err.message });
    }
  },

  async getTeamMembers(req: Request, res: Response) {
    try {
      const members = await visitService.getTeamMembers(req.user!.userId, req.user!.role);
      res.json({ success: true, data: members });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const visit = await visitService.getById((req.params.id as string));
      if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateNotes(req: Request, res: Response) {
    try {
      const { notes } = req.body;
      const visit = await visitService.updateNotes((req.params.id as string), notes);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const visit = await visitService.create(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // §6 Navigate: PLANNED → NAVIGATING
  async navigate(req: Request, res: Response) {
    try {
      const visit = await visitService.navigate((req.params.id as string), req.user!.userId);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // §6 Check-in: PLANNED/NAVIGATING → CHECKED_IN (with all guards)
  async checkIn(req: Request, res: Response) {
    try {
      const visit = await visitService.checkIn((req.params.id as string), req.user!.userId, req.body);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // §9 Prepare: CHECKED_IN → PREPARING
  async prepare(req: Request, res: Response) {
    try {
      const visit = await visitService.prepare((req.params.id as string), req.user!.userId);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // §11 Engage: PREPARING → ENGAGING
  async engage(req: Request, res: Response) {
    try {
      const visit = await visitService.engage((req.params.id as string), req.user!.userId, req.body);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // §12 Detail: ENGAGING → DETAILING
  async detail(req: Request, res: Response) {
    try {
      const visit = await visitService.detail((req.params.id as string), req.user!.userId);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // §13 Check-out: active states → CHECKED_OUT
  async checkOut(req: Request, res: Response) {
    try {
      const visit = await visitService.checkOut((req.params.id as string), req.user!.userId, req.body);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // §18 Submit Report: CHECKED_OUT/REPORT_PENDING → REPORTED
  async submitReport(req: Request, res: Response) {
    try {
      const visit = await visitService.submitReport((req.params.id as string), req.user!.userId, req.body);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // §2.2 Next Call: REPORTED → NEXT_CALL
  async nextCall(req: Request, res: Response) {
    try {
      const visit = await visitService.nextCall((req.params.id as string), req.user!.userId);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // §23 Mark Missed: PLANNED/NAVIGATING → MISSED
  async markMissed(req: Request, res: Response) {
    try {
      const { missedReason } = req.body;
      if (!missedReason) return res.status(400).json({ success: false, message: 'missedReason is required' });
      const visit = await visitService.markMissed((req.params.id as string), req.user!.userId, { missedReason });
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async approve(req: Request, res: Response) {
    try {
      const visit = await visitService.approve((req.params.id as string), req.user!.userId);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async reject(req: Request, res: Response) {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason required' });
      const visit = await visitService.reject((req.params.id as string), req.user!.userId, reason);
      res.json({ success: true, data: visit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async todayStats(req: Request, res: Response) {
    try {
      const stats = await visitService.getTodayStats(req.user!.userId);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
