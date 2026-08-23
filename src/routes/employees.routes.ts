import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { employeeController } from '../controllers/employee.controller';

const router = Router();
router.use(authenticate);

// List & Get
router.get('/', employeeController.list);
router.get('/:id', employeeController.getById);

// Create & Update (managers/admin only)
router.post('/', requireManager, employeeController.create);
router.put('/:id', requireManager, employeeController.update);

// Status toggles
router.patch('/:id/deactivate', requireManager, employeeController.deactivate);
router.patch('/:id/reactivate', requireManager, employeeController.reactivate);

// Password reset (admin only)
router.patch('/:id/reset-password', requireManager, employeeController.resetPassword);

// Territory assignment
router.post('/:id/territories', requireManager, employeeController.assignTerritory);
router.delete('/:id/territories', requireManager, employeeController.removeTerritory);

// Soft delete
router.delete('/:id', requireManager, employeeController.softDelete);

export default router;
