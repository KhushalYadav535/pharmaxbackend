import { Router } from 'express';
import { targetController } from '../controllers/target.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', targetController.list);
router.post('/', targetController.create);
router.get('/:id', targetController.getById);
router.put('/:id', targetController.update);
router.delete('/:id', targetController.delete);

export default router;
