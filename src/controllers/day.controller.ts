import { Request, Response } from 'express';
import { dayService } from '../services/day.service';

export const dayController = {
  // GET /day/status
  async getStatus(req: Request, res: Response) {
    try {
      const result = await dayService.getDayStatus(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /day/start
  async startDay(req: Request, res: Response) {
    try {
      const { lat, lng, gpsAccuracy, address, authMethod, deviceId } = req.body;
      const attendance = await dayService.startDay(req.user!.userId, {
        lat, lng, gpsAccuracy, address, authMethod, deviceId,
      });
      res.status(201).json({ success: true, data: attendance });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // POST /day/end  (DAY_END_REVIEW state)
  async beginDayEnd(req: Request, res: Response) {
    try {
      const result = await dayService.beginDayEnd(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // GET /day/close-check  (validate before closing)
  async closeCheck(req: Request, res: Response) {
    try {
      const result = await dayService.validateCloseDay(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /day/close
  async closeDay(req: Request, res: Response) {
    try {
      const result = await dayService.closeDay(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },
};
