import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { hrmsOrgController } from '../controllers/hrms-org.controller';

const router = Router();
router.use(authenticate);

// Departments
router.get('/departments', hrmsOrgController.listDepartments);
router.get('/departments/:id', hrmsOrgController.getDepartment);
router.post('/departments', requireManager, hrmsOrgController.createDepartment);
router.put('/departments/:id', requireManager, hrmsOrgController.updateDepartment);
router.delete('/departments/:id', requireManager, hrmsOrgController.deleteDepartment);

// Divisions
router.get('/divisions', hrmsOrgController.listDivisions);
router.post('/divisions', requireManager, hrmsOrgController.createDivision);
router.put('/divisions/:id', requireManager, hrmsOrgController.updateDivision);
router.delete('/divisions/:id', requireManager, hrmsOrgController.deleteDivision);

// Grade Bands
router.get('/grades', hrmsOrgController.listGradeBands);
router.post('/grades', requireManager, hrmsOrgController.createGradeBand);
router.put('/grades/:id', requireManager, hrmsOrgController.updateGradeBand);
router.delete('/grades/:id', requireManager, hrmsOrgController.deleteGradeBand);

// Designations
router.get('/designations', hrmsOrgController.listDesignations);
router.post('/designations', requireManager, hrmsOrgController.createDesignation);
router.put('/designations/:id', requireManager, hrmsOrgController.updateDesignation);
router.delete('/designations/:id', requireManager, hrmsOrgController.deleteDesignation);

// Settings
router.get('/settings', hrmsOrgController.getAllSettings);
router.put('/settings/:key', requireManager, hrmsOrgController.updateSetting);

export default router;
