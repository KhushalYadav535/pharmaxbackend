import { Request, Response } from 'express';
import { tourPlanService } from '../services/tourplan.service';

export const tourPlanController = {
  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const isAdmin = ['SUPER_ADMIN', 'SALES_ADMIN', 'NSM', 'ZM'].includes(user?.role);
      const isManager = ['ASM', 'RSM'].includes(user?.role);

      const filters: any = { ...req.query };
      // If normal MR, force their own userId (security)
      if (!isAdmin && !isManager) {
        filters.userId = user?.userId || user?.id;
      } 
      // If manager/admin didn't specify a userId, and they are viewing the mobile app, 
      // they might also want to see their own plans (if managers make plans), 
      // but usually the app wants the logged in user's plan.
      // So if no userId is passed, default to the logged in user's ID
      else if (!filters.userId) {
        filters.userId = user?.userId || user?.id;
      }

      const data = await tourPlanService.list(filters);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const data = await tourPlanService.getById(req.params.id as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      // req.user from auth middleware
      const userId = (req as any).user?.userId;
      const data = await tourPlanService.create(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await tourPlanService.update(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const data = await tourPlanService.updateStatus(req.params.id as string, req.body.status);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await tourPlanService.delete(req.params.id as string);
      res.json({ success: true, message: 'Tour Plan deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async addDay(req: Request, res: Response) {
    try {
      const data = await tourPlanService.addDay(req.params.id as string, req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async bulkAddVisits(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const visitsPayload = Array.isArray(req.body) ? req.body : req.body.visits;
      const data = await tourPlanService.bulkAddVisits(req.params.dayId as string, userId, visitsPayload);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async copyDay(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const data = await tourPlanService.copyDay(req.params.id as string, req.body.sourceDayId, req.body.targetDate, userId);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async copyMonth(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const data = await tourPlanService.copyMonth(req.params.id as string, req.body.sourceTourPlanId, userId);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async getCoverage(req: Request, res: Response) {
    try {
      const data = await tourPlanService.getCoverage(req.params.id as string);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
};
