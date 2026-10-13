import { Router } from 'express';
import { hrmsDocumentController } from '../controllers/hrmsDocumentController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { documentUpload } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

// Document repository routes
router.get('/stats', hrmsDocumentController.getStats);
router.get('/my', hrmsDocumentController.getMyDocuments);
router.get('/', hrmsDocumentController.listDocuments);
router.post('/upload', documentUpload.single('file'), hrmsDocumentController.uploadFile);
router.post('/', documentUpload.single('file'), hrmsDocumentController.createDocument);
router.get('/:id', hrmsDocumentController.getDocumentById);
router.patch('/:id/verify', requireManager, hrmsDocumentController.verifyDocument);
router.delete('/:id', requireManager, hrmsDocumentController.deleteDocument);

export default router;
