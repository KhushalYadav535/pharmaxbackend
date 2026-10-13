import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { hrmsAssignmentController } from '../controllers/hrms-assignment.controller';

const router = Router();
router.use(authenticate);

// Assignment history
router.get('/user/:userId', hrmsAssignmentController.getUserAssignments);

// Transfer / Assign Territory (effective-dated)
router.post('/', requireManager, hrmsAssignmentController.assignTerritory);

// Lifecycle Movements
router.get('/movements', requireManager, hrmsAssignmentController.listMovements);
router.post('/movements', requireManager, hrmsAssignmentController.createMovement);

export default router;
