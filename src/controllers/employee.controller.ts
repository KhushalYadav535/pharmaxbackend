import { Request, Response } from 'express';
import { employeeService } from '../services/employee.service';

export const employeeController = {
  async list(req: Request, res: Response) {
    try {
      const result = await employeeService.list(req.query);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async getById(req: Request, res: Response) {
    try {
      const item = await employeeService.getById(req.params['id'] as string);
      if (!item) return res.status(404).json({ success: false, message: 'Employee not found' });
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async create(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName, role } = req.body;
      if (!email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({ success: false, message: 'email, password, firstName, lastName and role are required' });
      }
      const item = await employeeService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await employeeService.update(req.params['id'] as string, req.body);
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async deactivate(req: Request, res: Response) {
    try {
      await employeeService.deactivate(req.params['id'] as string);
      res.json({ success: true, message: 'Employee deactivated' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async reactivate(req: Request, res: Response) {
    try {
      await employeeService.reactivate(req.params['id'] as string);
      res.json({ success: true, message: 'Employee reactivated' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }
      await employeeService.resetPassword(req.params['id'] as string, newPassword);
      res.json({ success: true, message: 'Password reset successfully' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async softDelete(req: Request, res: Response) {
    try {
      await employeeService.softDelete(req.params['id'] as string);
      res.json({ success: true, message: 'Employee removed' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async assignTerritory(req: Request, res: Response) {
    try {
      const { territoryId, isPrimary } = req.body;
      if (!territoryId) return res.status(400).json({ success: false, message: 'territoryId is required' });
      const result = await employeeService.assignTerritory(req.params['id'] as string, territoryId as string, isPrimary);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async removeTerritory(req: Request, res: Response) {
    try {
      const { territoryId } = req.body;
      if (!territoryId) return res.status(400).json({ success: false, message: 'territoryId is required' });
      await employeeService.removeTerritory(req.params['id'] as string, territoryId as string);
      res.json({ success: true, message: 'Territory removed' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
};
