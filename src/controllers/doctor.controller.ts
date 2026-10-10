import { Request, Response } from 'express';
import { doctorService } from '../services/doctor.service';
import prisma from '../config/database';

export const doctorController = {
  async list(req: Request, res: Response) {
    try {
      const result = await doctorService.list(
        {
          search: req.query.search as string,
          specialty: req.query.specialty as string,
          category: req.query.category as string,
          classification: req.query.classification as any,
          territoryId: req.query.territoryId as string,
          hqId: (req.query.hqId || req.query.headquarterId) as string,
          areaId: req.query.areaId as string,
          hospitalId: req.query.hospitalId as string,
          approvalStatus: req.query.approvalStatus as any,
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
      const doctor = await doctorService.getById(req.params.id as string as string);
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
      res.json({ success: true, data: doctor });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      if (req.user && ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied: Only administrators can add new doctors.' });
      }

      const { productIds, ...bodyData } = req.body;
      const data: any = { ...bodyData };
      
      if (productIds && productIds.length > 0) {
        data.productsSelected = {
          create: productIds.map((id: string) => ({ productId: id }))
        };
      }

      // Auto-assign territory if not provided
      if (!data.territoryId) {
        const userTerritory = await prisma.userTerritory.findFirst({
          where: { userId: req.user!.userId },
        });
        if (userTerritory) {
          data.territoryId = userTerritory.territoryId;
        }
      }

      const doctor = await doctorService.create(data);
      res.status(201).json({ success: true, data: doctor, message: 'Doctor created successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { productIds, ...updateData } = req.body;
      const data: any = { ...updateData };

      // MR cannot modify doctor specialty or category assignment (Admin only)
      if (req.user && ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user.role)) {
        if (data.specialty !== undefined || data.category !== undefined) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: Only administrators can assign or modify doctor specialties/categories.'
          });
        }
      }

      if (productIds) {
        data.productsSelected = {
          deleteMany: {},
          create: productIds.map((id: string) => ({ productId: id }))
        };
      }

      const doctor = await doctorService.update(req.params.id as string as string, data);
      res.json({ success: true, data: doctor, message: 'Doctor updated successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      if (req.user && ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied: Only administrators can delete doctors.' });
      }

      await doctorService.softDelete(req.params.id as string as string);
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

  async bulkCreate(req: Request, res: Response) {
    try {
      if (req.user && ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied: Only administrators can import doctors.' });
      }

      const { doctors } = req.body;
      if (!Array.isArray(doctors) || doctors.length === 0) {
        return res.status(400).json({ success: false, message: 'An array of doctor records is required' });
      }

      const defaultTerritory = await prisma.territory.findFirst({ select: { id: true } });
      const defaultHQ = defaultTerritory;

      let createdCount = 0;
      const errors: any[] = [];

      for (let i = 0; i < doctors.length; i++) {
        const item = doctors[i];
        if (!item.firstName && !item.name) {
          errors.push({ index: i, error: 'Doctor name is required' });
          continue;
        }

        try {
          const names = (item.name || item.firstName || '').trim().split(' ');
          const fName = item.firstName || names[0] || 'Doctor';
          const lName = item.lastName || (names.length > 1 ? names.slice(1).join(' ') : 'MD');

          await prisma.doctor.create({
            data: {
              firstName: fName,
              lastName: lName,
              salutation: item.salutation || 'Dr.',
              doctorCode: item.doctorCode || `DOC-${Date.now().toString().slice(-6)}-${i}`,
              specialty: item.specialty || 'GENERAL_PRACTICE',
              qualification: item.qualification || 'MBBS',
              classification: item.classification || 'A',
              category: item.category || 'CORE',
              city: item.city || 'Nagpur',
              state: item.state || 'Maharashtra',
              phone: item.phone || item.mobileNumber || null,
              email: item.email || null,
              address: item.address || null,
              pin: item.pin ? String(item.pin) : null,
              territoryId: item.territoryId || defaultTerritory?.id,
              hqId: item.hqId || item.headquarterId || defaultHQ?.id,
              isActive: true,
            },
          });
          createdCount++;
        } catch (itemErr: any) {
          errors.push({ index: i, doctor: item.firstName || item.name, error: itemErr.message });
        }
      }

      res.status(201).json({
        success: true,
        data: { createdCount, totalRequested: doctors.length, errors },
        message: `Successfully imported ${createdCount} of ${doctors.length} doctors`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async bulkTransfer(req: Request, res: Response) {
    try {
      if (req.user && ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied: Only administrators can reassign doctors.' });
      }

      const { doctorIds, territoryId, hqId } = req.body;
      if (!Array.isArray(doctorIds) || doctorIds.length === 0) {
        return res.status(400).json({ success: false, message: 'doctorIds array is required' });
      }

      const updateData: any = {};
      if (territoryId) updateData.territoryId = territoryId;
      if (hqId) updateData.hqId = hqId;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: 'At least one target territoryId or hqId is required' });
      }

      const updated = await prisma.doctor.updateMany({
        where: { id: { in: doctorIds } },
        data: updateData,
      });

      res.json({
        success: true,
        data: { transferredCount: updated.count },
        message: `Successfully transferred ${updated.count} doctors`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
