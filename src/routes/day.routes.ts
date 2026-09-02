import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { dayController } from '../controllers/day.controller';

const router = Router();
router.use(authenticate);

router.get('/status',      dayController.getStatus);
router.post('/start',      auditLog('START_DAY', 'Attendance'), dayController.startDay);
router.post('/end',        auditLog('DAY_END', 'Attendance'),   dayController.beginDayEnd);
router.get('/close-check', dayController.closeCheck);
router.post('/close',      auditLog('CLOSE_DAY', 'Attendance'), dayController.closeDay);

export default router;
