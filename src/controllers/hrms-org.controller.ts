import { Request, Response } from 'express';
import { hrmsOrgService } from '../services/hrms-org.service';

export const hrmsOrgController = {
  // Departments
  async listDepartments(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.listDepartments();
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async getDepartment(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.getDepartmentById(req.params.id as string);
      if (!data) return res.status(404).json({ success: false, message: 'Department not found' });
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async createDepartment(req: Request, res: Response) {
    try {
      const { name, code, headId, status } = req.body;
      if (!name || !code) return res.status(400).json({ success: false, message: 'Name and code are required' });
      const data = await hrmsOrgService.createDepartment({ name, code, headId, status });
      res.status(201).json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async updateDepartment(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.updateDepartment(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async deleteDepartment(req: Request, res: Response) {
    try {
      await hrmsOrgService.deleteDepartment(req.params.id as string);
      res.json({ success: true, message: 'Department deleted successfully' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  // Divisions
  async listDivisions(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.listDivisions();
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async createDivision(req: Request, res: Response) {
    try {
      const { name, code, businessUnit, status } = req.body;
      if (!name || !code) return res.status(400).json({ success: false, message: 'Name and code are required' });
      const data = await hrmsOrgService.createDivision({ name, code, businessUnit, status });
      res.status(201).json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async updateDivision(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.updateDivision(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async deleteDivision(req: Request, res: Response) {
    try {
      await hrmsOrgService.deleteDivision(req.params.id as string);
      res.json({ success: true, message: 'Division deleted successfully' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  // Grade Bands
  async listGradeBands(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.listGradeBands();
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async createGradeBand(req: Request, res: Response) {
    try {
      const { name, code, level, description, status } = req.body;
      if (!name || !code) return res.status(400).json({ success: false, message: 'Name and code are required' });
      const data = await hrmsOrgService.createGradeBand({ name, code, level, description, status });
      res.status(201).json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async updateGradeBand(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.updateGradeBand(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async deleteGradeBand(req: Request, res: Response) {
    try {
      await hrmsOrgService.deleteGradeBand(req.params.id as string);
      res.json({ success: true, message: 'Grade band deleted successfully' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  // Designations
  async listDesignations(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.listDesignations();
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async createDesignation(req: Request, res: Response) {
    try {
      const { name, code, gradeBandId, departmentId, status } = req.body;
      if (!name || !code) return res.status(400).json({ success: false, message: 'Name and code are required' });
      const data = await hrmsOrgService.createDesignation({ name, code, gradeBandId, departmentId, status });
      res.status(201).json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async updateDesignation(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.updateDesignation(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  async deleteDesignation(req: Request, res: Response) {
    try {
      await hrmsOrgService.deleteDesignation(req.params.id as string);
      res.json({ success: true, message: 'Designation deleted successfully' });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },

  // Settings
  async getAllSettings(req: Request, res: Response) {
    try {
      const data = await hrmsOrgService.getAllSettings();
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  },

  async updateSetting(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      if (!value) return res.status(400).json({ success: false, message: 'Value is required' });
      const data = await hrmsOrgService.updateSetting(key as string, String(value), description, req.user?.userId);
      res.json({ success: true, data });
    } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
  },
};
