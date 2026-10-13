import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { hrmsReportingController } from '../controllers/hrms-reporting.controller';

const router = Router();
router.use(authenticate);

// Organization reporting tree
router.get('/tree', requireManager, hrmsReportingController.getReportingTree);

// Manager team hierarchy
router.get('/team', requireManager, hrmsReportingController.getTeamHierarchy);
router.get('/team/:managerId', requireManager, hrmsReportingController.getTeamHierarchy);

export default router;
