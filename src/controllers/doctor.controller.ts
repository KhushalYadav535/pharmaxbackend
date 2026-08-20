import { Request, Response } from 'express';
import { doctorService } from '../services/doctor.service';

export const doctorController = {
  async list(req: Request, res: Response) {
    try {
      const result = await doctorService.list(
        {
          search: req.query.search as string,
          specialty: req.query.specialty as string,
          classification: req.query.classification as any,
          territoryId: req.query.territoryId as string,
          hospitalId: req.query.hospitalId as string,
          page: req.query.page ? parseInt(req.query.page as string) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        },
        req.user!.userId,
        req.user!.role,
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const doctor = await doctorService.getById(req.params.id as string);
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
      res.json({ success: true, data: doctor });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const doctor = await doctorService.create(req.body);
      res.status(201).json({ success: true, data: doctor, message: 'Doctor created successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const doctor = await doctorService.update(req.params.id as string, req.body);
      res.json({ success: true, data: doctor, message: 'Doctor updated successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await doctorService.softDelete(req.params.id as string);
      res.json({ success: true, message: 'Doctor deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async stats(req: Request, res: Response) {
    try {
      const stats = await doctorService.getStats(req.user!.userId, req.user!.role);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
