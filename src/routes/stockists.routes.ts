import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { stockistController } from '../controllers/stockist.controller';

const router = Router();
router.use(authenticate);
router.get('/', stockistController.list);
router.get('/:id', stockistController.getById);
router.post('/', stockistController.create);
router.put('/:id', stockistController.update);
router.patch('/:id/deactivate', stockistController.deactivate);
export default router;

