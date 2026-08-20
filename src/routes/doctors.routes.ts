import { Router } from 'express';
import { doctorController } from '../controllers/doctor.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';

const router = Router();
router.use(authenticate);

router.get('/', doctorController.list);
router.get('/stats', doctorController.stats);
router.get('/:id', doctorController.getById);
router.post('/', auditLog('CREATE', 'Doctor'), doctorController.create);
router.put('/:id', auditLog('UPDATE', 'Doctor'), doctorController.update);
router.delete('/:id', auditLog('DELETE', 'Doctor'), doctorController.delete);

export default router;
