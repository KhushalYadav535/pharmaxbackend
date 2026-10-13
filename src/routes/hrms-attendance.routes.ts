import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { hrmsAttendanceController } from '../controllers/hrmsAttendanceController';

const router = Router();
router.use(authenticate);

// Attendance register & exceptions
router.get('/register', hrmsAttendanceController.getRegister);
router.get('/exceptions', hrmsAttendanceController.getExceptions);

// Employee summary & calendar
router.get('/my-summary', hrmsAttendanceController.getMySummary);
router.get('/user/:userId/summary', hrmsAttendanceController.getUserSummary);

// Regularization requests
router.post('/regularizations', hrmsAttendanceController.requestRegularization);
router.get('/regularizations', hrmsAttendanceController.listRegularizations);
router.get('/my-regularizations', hrmsAttendanceController.listMyRegularizations);
router.post('/regularizations/:id/review', requireManager, hrmsAttendanceController.reviewRegularization);
router.patch('/regularizations/:id/review', requireManager, hrmsAttendanceController.reviewRegularization);

export default router;
