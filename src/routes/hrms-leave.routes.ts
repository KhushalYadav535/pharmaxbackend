import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager, requireAdmin } from '../middlewares/rbac.middleware';
import { hrmsLeaveController } from '../controllers/hrmsLeaveController';

const router = Router();
router.use(authenticate);

// Leave Types (Admin managed)
router.get('/types', hrmsLeaveController.listTypes);
router.post('/types', requireAdmin, hrmsLeaveController.createType);
router.put('/types/:id', requireAdmin, hrmsLeaveController.updateType);

// Leave Balances
router.get('/my-balances', hrmsLeaveController.getMyBalances);
router.get('/user/:userId/balances', hrmsLeaveController.getUserBalances);

// Leave Applications & Reviews
router.post('/applications', hrmsLeaveController.applyLeave);
router.get('/applications', hrmsLeaveController.listLeaves);
router.get('/my-applications', hrmsLeaveController.listMyLeaves);
router.post('/applications/:id/review', requireManager, hrmsLeaveController.reviewLeave);
router.patch('/applications/:id/review', requireManager, hrmsLeaveController.reviewLeave);
router.post('/applications/:id/cancel', hrmsLeaveController.cancelLeave);

// Holiday Calendar (Admin managed)
router.get('/holidays', hrmsLeaveController.listHolidays);
router.post('/holidays', requireAdmin, hrmsLeaveController.createHoliday);
router.put('/holidays/:id', requireAdmin, hrmsLeaveController.updateHoliday);
router.delete('/holidays/:id', requireAdmin, hrmsLeaveController.deleteHoliday);

export default router;
