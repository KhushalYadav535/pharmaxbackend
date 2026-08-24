import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';

const router = Router();
router.use(authenticate);

router.get('/', productController.list);
router.get('/:id', productController.getById);
router.post('/', auditLog('CREATE', 'Product'), productController.create);
router.put('/:id', auditLog('UPDATE', 'Product'), productController.update);
router.delete('/:id', auditLog('DELETE', 'Product'), productController.deactivate);

export default router;
