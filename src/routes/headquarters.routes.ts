import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { headquarterController } from '../controllers/headquarter.controller';

const router = Router();
router.use(authenticate);
router.get('/', headquarterController.list);
router.get('/:id', headquarterController.getById);
router.post('/', headquarterController.create);
router.put('/:id', headquarterController.update);
router.delete('/:id', headquarterController.deleteById);
export default router;
