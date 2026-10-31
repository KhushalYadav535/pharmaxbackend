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
          interiorId: req.query.interiorId as string,
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

      // Sanitize foreign key strings: convert empty strings to null/undefined
      const fkFields = ['areaId', 'interiorId', 'hqId', 'territoryId', 'hospitalId', 'retailerId'];
      for (const field of fkFields) {
        if (data[field] === '') {
          delete data[field];
        }
      }

      // Sync HQ and Territory
      if (!data.territoryId && data.hqId) {
        data.territoryId = data.hqId;
      }
      if (!data.hqId && data.territoryId) {
        data.hqId = data.territoryId;
      }

      // Auto-assign territory if not provided
      if (!data.territoryId) {
        const userTerritory = await prisma.userTerritory.findFirst({
          where: { userId: req.user!.userId },
        });
        if (userTerritory) {
          data.territoryId = userTerritory.territoryId;
          data.hqId = data.hqId || userTerritory.territoryId;
        }
      }

      if (!data.approvalStatus) {
        data.approvalStatus = 'APPROVED';
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

      // MR cannot modify doctor master details (HQ, Area, Classification, Name, etc.).
      // However, MRs CAN update prescribed/detailing products (productIds) during field visits.
      if (req.user && ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user.role)) {
        if (productIds === undefined) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: Medical Representatives cannot edit doctors. Only Administrators can modify doctor master details.'
          });
        }

        await prisma.doctorProduct.deleteMany({ where: { doctorId: req.params.id as string } });
        if (Array.isArray(productIds) && productIds.length > 0) {
          await prisma.doctorProduct.createMany({
            data: productIds.map((pid: string) => ({ doctorId: req.params.id as string, productId: pid }))
          });
        }
        const updatedDoc = await doctorService.getById(req.params.id as string);
        return res.json({ success: true, data: updatedDoc, message: 'Doctor products updated successfully' });
      }

      // Sanitize foreign key strings: convert empty strings to null so Prisma clears the relation
      const fkFields = ['areaId', 'interiorId', 'hqId', 'territoryId', 'hospitalId', 'retailerId'];
      for (const field of fkFields) {
        if (data[field] === '') {
          data[field] = null;
        }
      }

      // If hqId is set but territoryId isn't, keep them in sync
      if (data.hqId && !data.territoryId) {
        data.territoryId = data.hqId;
      }

      if (productIds) {
        data.productsSelected = {
          deleteMany: {},
          create: productIds.map((id: string) => ({ productId: id }))
        };
      }

      const doctor = await doctorService.update(req.params.id as string, data);
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

      const { doctors, hqId: reqHqId, territoryId: reqTerritoryId } = req.body;
      if (!Array.isArray(doctors) || doctors.length === 0) {
        return res.status(400).json({ success: false, message: 'An array of doctor records is required' });
      }

      // Resolve target Headquarter / Territory
      let targetHQ: any = null;
      const targetHqIdToFind = reqHqId || reqTerritoryId;
      if (targetHqIdToFind) {
        targetHQ = await prisma.territory.findUnique({
          where: { id: targetHqIdToFind },
          select: { id: true, name: true, district: true, state: true }
        });
      }
      if (!targetHQ) {
        targetHQ = await prisma.territory.findFirst({
          select: { id: true, name: true, district: true, state: true }
        });
      }

      // Fetch all existing active doctors to build in-memory deduplication indexes
      const existingDoctors = await prisma.doctor.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          doctorCode: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true,
          hqId: true,
          territoryId: true,
        },
      });

      // Helper to clean and normalize phone number (extract last 10 digits)
      const cleanPhoneDigits = (val?: any): string => {
        if (!val) return '';
        const digits = String(val).replace(/\D/g, '');
        return digits.length >= 10 ? digits.slice(-10) : digits;
      };

      const parseSheetDate = (val?: any): Date | null => {
        if (!val) return null;
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        if (typeof val === 'number' && val > 1000 && val < 60000) {
          const d = new Date(Math.round((val - 25569) * 86400 * 1000));
          return isNaN(d.getTime()) ? null : d;
        }
        const str = String(val).trim();
        const parts = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
        if (parts) {
          const day = parseInt(parts[1], 10);
          const month = parseInt(parts[2], 10) - 1;
          let year = parseInt(parts[3], 10);
          if (year < 100) year += year > 50 ? 1900 : 2000;
          const d = new Date(year, month, day);
          return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
      };

      const normalizeDoctorName = (first?: string, last?: string): string => {
        return `${first || ''} ${last || ''}`
          .toLowerCase()
          .replace(/^dr\.?\s*/i, '')
          .replace(/[^a-z0-9]/g, '');
      };

      const existingCodes = new Set<string>();
      const existingPhones = new Set<string>();
      const existingEmails = new Set<string>();
      const existingNameHq = new Set<string>();

      for (const d of existingDoctors) {
        if (d.doctorCode) existingCodes.add(d.doctorCode.trim().toLowerCase());
        const ph = cleanPhoneDigits(d.phone);
        if (ph && ph.length >= 10) existingPhones.add(ph);
        if (d.email) existingEmails.add(d.email.trim().toLowerCase());

        const normName = normalizeDoctorName(d.firstName, d.lastName);
        if (normName) {
          if (d.hqId) existingNameHq.add(`${normName}_${d.hqId}`);
          if (d.territoryId) existingNameHq.add(`${normName}_${d.territoryId}`);
          existingNameHq.add(`${(d.firstName || '').trim().toLowerCase()}_${(d.lastName || '').trim().toLowerCase()}_${d.hqId || d.territoryId || ''}`);
        }
      }

      // Track items seen in the current batch to prevent intra-sheet duplicates
      const batchCodes = new Set<string>();
      const batchPhones = new Set<string>();
      const batchEmails = new Set<string>();
      const batchNameHq = new Set<string>();

      let createdCount = 0;
      let skippedCount = 0;
      const skippedDoctors: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < doctors.length; i++) {
        const item = doctors[i];
        const rawName = (item.name || item.firstName || '').toString().trim();
        if (!rawName && !item.lastName) {
          errors.push({ index: i, error: 'Doctor name is required' });
          continue;
        }

        const names = rawName.split(' ');
        const fName = (item.firstName || names[0] || 'Doctor').toString().trim();
        const lName = (item.lastName || (names.length > 1 ? names.slice(1).join(' ') : 'MD')).toString().trim();

        const docCode = item.doctorCode ? String(item.doctorCode).trim() : '';
        const rawPhone = item.phone || item.mobileNumber;
        const docPhone = cleanPhoneDigits(rawPhone);
        const docEmail = item.email ? String(item.email).trim().toLowerCase() : '';

        // Prioritize explicit row HQ, then selected batch HQ, then default HQ
        const rowHqId = item.hqId || item.headquarterId || targetHQ?.id || null;
        const rowTerritoryId = item.territoryId || rowHqId || targetHQ?.id || null;
        const normInputName = normalizeDoctorName(fName, lName);
        const nameKeyHq = `${normInputName}_${rowHqId || ''}`;
        const nameKeyTerritory = `${normInputName}_${rowTerritoryId || ''}`;
        const legacyNameHqKey = `${fName.toLowerCase()}_${lName.toLowerCase()}_${rowHqId || ''}`;

        // ── Deduplication Check ──
        let skipReason = '';
        if (docCode && (existingCodes.has(docCode.toLowerCase()) || batchCodes.has(docCode.toLowerCase()))) {
          skipReason = `Doctor code "${docCode}" already exists in database`;
        } else if (docPhone && docPhone.length >= 10 && (existingPhones.has(docPhone) || batchPhones.has(docPhone))) {
          skipReason = `Doctor with phone number "${docPhone}" already exists in database`;
        } else if (docEmail && (existingEmails.has(docEmail) || batchEmails.has(docEmail))) {
          skipReason = `Doctor with email "${docEmail}" already exists in database`;
        } else if (
          (normInputName && (existingNameHq.has(nameKeyHq) || existingNameHq.has(nameKeyTerritory) || batchNameHq.has(nameKeyHq) || batchNameHq.has(nameKeyTerritory))) ||
          existingNameHq.has(legacyNameHqKey) ||
          batchNameHq.has(legacyNameHqKey)
        ) {
          skipReason = `Dr. ${fName} ${lName} already exists in this Headquarter`;
        }

        if (skipReason) {
          skippedCount++;
          skippedDoctors.push({
            index: i,
            name: `Dr. ${fName} ${lName}`,
            doctorCode: docCode || undefined,
            phone: rawPhone || undefined,
            specialty: item.specialty || undefined,
            reason: skipReason,
          });
          continue; // Skip duplicate doctor as requested
        }

        if (normInputName) {
          if (rowHqId) batchNameHq.add(nameKeyHq);
          if (rowTerritoryId) batchNameHq.add(nameKeyTerritory);
          batchNameHq.add(legacyNameHqKey);
        }

        // ── Create Doctor ──
        try {
          const finalDocCode = docCode || `DOC-${Date.now().toString().slice(-6)}-${i + 1}`;
          
          let parsedClassification = 'A';
          const rawClass = (item.classification || 'A').toString().toUpperCase().replace('+', '_PLUS');
          if (['A_PLUS', 'A', 'B', 'C'].includes(rawClass)) {
            parsedClassification = rawClass;
          }

          await prisma.doctor.create({
            data: {
              firstName: fName,
              lastName: lName,
              salutation: item.salutation || 'Dr.',
              doctorCode: finalDocCode,
              specialty: item.specialty || 'GENERAL_PRACTICE',
              qualification: item.qualification || 'MBBS',
              classification: parsedClassification as any,
              category: item.category || 'CORE',
              city: item.city || targetHQ?.district || 'Nagpur',
              state: item.state || targetHQ?.state || 'Maharashtra',
              phone: rawPhone ? String(rawPhone).trim() : null,
              whatsappNumber: item.whatsappNumber ? String(item.whatsappNumber).trim() : null,
              email: item.email ? String(item.email).trim() : null,
              address1: item.address1 || item.address || null,
              address2: item.address2 || null,
              pincode: (item.pincode || item.pin) ? String(item.pincode || item.pin) : null,
              territoryId: rowTerritoryId,
              hqId: rowHqId,
              areaId: item.areaId || null,
              interiorId: item.interiorId || null,
              hospitalId: item.hospitalId || null,
              retailerId: item.retailerId || null,
              prescriptionPotential: Number(item.prescriptionPotential) || 0,
              isKol: item.isKol === true || String(item.isKol).toLowerCase() === 'true' || String(item.isKol).toLowerCase() === 'yes',
              kolCategory: item.kolCategory || null,
              dateOfBirth: parseSheetDate(item.dateOfBirth || item.dob),
              marriageAnniversary: parseSheetDate(item.marriageAnniversary || item.dom),
              approvalStatus: 'APPROVED',
              isActive: true,
            },
          });

          // Register in index sets so intra-file duplicates are also handled
          if (docCode) {
            existingCodes.add(docCode.toLowerCase());
            batchCodes.add(docCode.toLowerCase());
          }
          if (docPhone && docPhone.length >= 10) {
            existingPhones.add(docPhone);
            batchPhones.add(docPhone);
          }
          if (docEmail) {
            existingEmails.add(docEmail);
            batchEmails.add(docEmail);
          }
          if (normInputName) {
            if (rowHqId) {
              existingNameHq.add(nameKeyHq);
              batchNameHq.add(nameKeyHq);
            }
            if (rowTerritoryId) {
              existingNameHq.add(nameKeyTerritory);
              batchNameHq.add(nameKeyTerritory);
            }
            existingNameHq.add(legacyNameHqKey);
            batchNameHq.add(legacyNameHqKey);
          }

          createdCount++;
        } catch (itemErr: any) {
          errors.push({ index: i, doctor: `Dr. ${fName} ${lName}`, error: itemErr.message });
        }
      }

      res.status(201).json({
        success: true,
        data: {
          totalRequested: doctors.length,
          createdCount,
          skippedCount,
          skippedDoctors,
          errors,
        },
        message: `Successfully processed ${doctors.length} doctors: ${createdCount} imported, ${skippedCount} existing doctor(s) skipped.`,
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

  async bulkDelete(req: Request, res: Response) {
    try {
      if (req.user && ['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied: Only administrators can bulk delete doctors.' });
      }

      const { doctorIds, hqId, deleteAllInHq } = req.body;

      if (deleteAllInHq && hqId) {
        const result = await doctorService.bulkSoftDeleteByHq(hqId);
        return res.json({
          success: true,
          data: { deletedCount: result.count },
          message: `Successfully deleted ${result.count} doctors from this headquarter.`
        });
      }

      if (!Array.isArray(doctorIds) || doctorIds.length === 0) {
        return res.status(400).json({ success: false, message: 'doctorIds array or hqId with deleteAllInHq is required' });
      }

      const result = await doctorService.bulkSoftDelete(doctorIds);
      return res.json({
        success: true,
        data: { deletedCount: result.count },
        message: `Successfully deleted ${result.count} selected doctors.`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const doctor = await doctorService.update(req.params.id as string, { isActive: false });
      res.json({ success: true, data: doctor, message: 'Doctor deactivated successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async reactivate(req: Request, res: Response) {
    try {
      const doctor = await doctorService.update(req.params.id as string, { isActive: true });
      res.json({ success: true, data: doctor, message: 'Doctor reactivated successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
