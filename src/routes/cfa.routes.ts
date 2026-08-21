import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { cfaController } from '../controllers/cfa.controller';

const router = Router();
router.use(authenticate);
router.get('/', cfaController.list);
router.get('/:id', cfaController.getById);
router.post('/', cfaController.create);
router.put('/:id', cfaController.update);
router.patch('/:id/deactivate', cfaController.deactivate);
export default router;
