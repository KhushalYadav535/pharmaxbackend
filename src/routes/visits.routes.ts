import { Router } from 'express';
import { visitController } from '../controllers/visit.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';

const router = Router();
router.use(authenticate);

router.get('/', visitController.list);
router.get('/today-stats', visitController.todayStats);
router.get('/:id', visitController.getById);
router.post('/', auditLog('CREATE', 'Visit'), visitController.create);
router.patch('/:id/check-in', visitController.checkIn);
router.patch('/:id/check-out', visitController.checkOut);
router.patch('/:id/approve', requireManager, visitController.approve);
router.patch('/:id/reject', requireManager, visitController.reject);

export default router;
