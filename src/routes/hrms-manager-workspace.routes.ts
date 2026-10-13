import { Router } from 'express';
import { hrmsManagerWorkspaceController } from '../controllers/hrmsManagerWorkspaceController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);
router.use(requireManager);

// Workspace endpoints
router.get('/snapshot', hrmsManagerWorkspaceController.getSnapshot);
router.get('/pending-approvals', hrmsManagerWorkspaceController.getPendingApprovals);
router.get('/monthly-performance', hrmsManagerWorkspaceController.getMonthlyPerformance);
router.patch('/expenses/:id/settle', hrmsManagerWorkspaceController.settleExpense);

export default router;
