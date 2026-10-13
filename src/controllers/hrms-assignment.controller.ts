import { Request, Response } from 'express';
import { hrmsAssignmentService } from '../services/hrms-assignment.service';

export const hrmsAssignmentController = {
  async getUserAssignments(req: Request, res: Response) {
    try {
      const data = await hrmsAssignmentService.getUserAssignments(req.params.userId as string);
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async assignTerritory(req: Request, res: Response) {
    try {
      const { userId, divisionId, regionId, areaId, hqId, territoryId, managerId, effectiveFrom, reason } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

      const data = await hrmsAssignmentService.assignTerritory({
        userId,
        divisionId,
        regionId,
        areaId,
        hqId,
        territoryId,
        managerId,
        effectiveFrom,
        reason,
        assignedById: req.user?.userId,
      });

      res.status(201).json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async listMovements(req: Request, res: Response) {
    try {
      const { userId, movementType, fromDate, toDate } = req.query;
      const data = await hrmsAssignmentService.listMovements({
        userId: userId as string,
        movementType: movementType as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async createMovement(req: Request, res: Response) {
    try {
      const { userId, movementType, effectiveDate, previousValue, newValue, reason, supportingDocUrl, status } = req.body;
      if (!userId || !movementType) {
        return res.status(400).json({ success: false, message: 'userId and movementType are required' });
      }

      const data = await hrmsAssignmentService.createMovement({
        userId,
        movementType,
        effectiveDate,
        previousValue,
        newValue,
        reason,
        supportingDocUrl,
        status,
        approvedById: req.user?.userId,
      });

      res.status(201).json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
};
