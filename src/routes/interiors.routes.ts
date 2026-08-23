import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { interiorController } from '../controllers/interior.controller';

const router = Router();
router.use(authenticate);
router.get('/', interiorController.list);
router.get('/:id', interiorController.getById);
router.post('/', interiorController.create);
router.put('/:id', interiorController.update);
router.patch('/:id/deactivate', interiorController.deactivate);
router.patch('/:id/reactivate', interiorController.reactivate);
router.delete('/:id', interiorController.deleteById);
export default router;
