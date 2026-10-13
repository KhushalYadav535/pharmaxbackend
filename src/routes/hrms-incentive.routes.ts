import { Router } from 'express';
import { hrmsIncentiveController } from '../controllers/hrmsIncentiveController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager, requireAdmin } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Plans
router.get('/plans', hrmsIncentiveController.listPlans);
router.post('/plans', requireAdmin, hrmsIncentiveController.createPlan);
router.put('/plans/:id', requireAdmin, hrmsIncentiveController.updatePlan);

// Summary & calculations
router.get('/summary', hrmsIncentiveController.getSummary);
router.get('/my', hrmsIncentiveController.getMyCalculations);
router.get('/calculations', requireManager, hrmsIncentiveController.listCalculations);
router.post('/calculate', requireManager, hrmsIncentiveController.runCalculation);
router.patch('/calculations/:id/status', requireManager, hrmsIncentiveController.updateStatus);

export default router;
