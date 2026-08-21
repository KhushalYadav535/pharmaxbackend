import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { taskController } from '../controllers/task.controller';

const router = Router();
router.use(authenticate);
router.get('/', taskController.list);
router.get('/:id', taskController.getById);
router.post('/', taskController.create);
router.put('/:id', taskController.update);
router.patch('/:id/complete', taskController.complete);
export default router;
