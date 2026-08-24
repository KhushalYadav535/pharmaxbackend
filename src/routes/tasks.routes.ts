import { Router } from 'express';
import { taskController } from '../controllers/task.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', taskController.list);
router.post('/', taskController.create);
router.get('/:id', taskController.getById);
router.put('/:id', taskController.update);
router.patch('/:id/status', taskController.updateStatus);
router.delete('/:id', taskController.delete);

export default router;
