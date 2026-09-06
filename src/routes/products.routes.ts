import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', productController.list);
router.get('/:id', productController.getById);
router.post('/', auditLog('CREATE', 'Product'), requireRole(UserRole.SUPER_ADMIN), productController.create);
router.put('/:id', auditLog('UPDATE', 'Product'), requireRole(UserRole.SUPER_ADMIN), productController.update);
router.delete('/:id', auditLog('DELETE', 'Product'), requireRole(UserRole.SUPER_ADMIN), productController.deactivate);

export default router;

