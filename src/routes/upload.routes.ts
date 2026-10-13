import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { documentUpload } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.post('/', documentUpload.single('file'), (req, res) => {
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
});

export default router;
