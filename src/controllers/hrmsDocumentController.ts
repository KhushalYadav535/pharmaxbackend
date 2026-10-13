import { Request, Response } from 'express';
import { hrmsDocumentService } from '../services/hrmsDocumentService';

export const hrmsDocumentController = {
  async listDocuments(req: Request, res: Response) {
    try {
      const { category, status, expiringDays, search } = req.query;
      let targetUserId = req.query.userId as string | undefined;

      // Field reps can only see their own non-confidential documents
      if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user?.role || '')) {
        targetUserId = req.user!.userId;
      }

      const data = await hrmsDocumentService.listDocuments({
        userId: targetUserId,
        category: category as string,
        status: status as string,
        expiringDays: expiringDays ? parseInt(expiringDays as string, 10) : undefined,
        search: search as string,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getMyDocuments(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { category } = req.query;
      const data = await hrmsDocumentService.listDocuments({
        userId,
        category: category as string,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getDocumentById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const data = await hrmsDocumentService.getDocumentById(id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async uploadFile(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const fileUrl = `/uploads/documents/${req.file.filename}`;
      return res.json({
        success: true,
        data: {
          fileUrl,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  async createDocument(req: Request, res: Response) {
    try {
      const uploadedById = req.user!.userId;
      const userId = req.body.userId || uploadedById;

      let fileUrl = req.body.fileUrl;
      let fileSize = req.body.fileSize ? Number(req.body.fileSize) : undefined;
      let fileType = req.body.fileType;

      if (req.file) {
        fileUrl = `/uploads/documents/${req.file.filename}`;
        fileSize = req.file.size;
        fileType = req.file.mimetype;
      }

      if (!fileUrl) {
        return res.status(400).json({ success: false, message: 'Please upload a file or provide a file URL' });
      }

      let isConfidential = req.body.isConfidential;
      if (typeof isConfidential === 'string') {
        isConfidential = isConfidential === 'true';
      }

      const data = await hrmsDocumentService.createDocument({
        ...req.body,
        fileUrl,
        fileSize,
        fileType,
        isConfidential,
        userId,
        uploadedById,
      });
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async verifyDocument(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const verifierId = req.user!.userId;
      const { status, notes } = req.body;
      const data = await hrmsDocumentService.verifyDocument(id, verifierId, status, notes);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async deleteDocument(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await hrmsDocumentService.deleteDocument(id);
      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async getStats(req: Request, res: Response) {
    try {
      const data = await hrmsDocumentService.getDocumentStats();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
