import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { targetController } from '../controllers/target.controller';

const router = Router();
router.use(authenticate);
router.get('/', targetController.list);
router.get('/:id', targetController.getById);
router.post('/', targetController.create);
router.put('/:id', targetController.update);
export default router;
