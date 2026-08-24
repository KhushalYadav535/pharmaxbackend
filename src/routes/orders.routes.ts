import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', orderController.list);
router.post('/', orderController.create);
router.get('/:id', orderController.getById);
router.patch('/:id/status', orderController.updateStatus);
router.delete('/:id', orderController.delete);

export default router;
