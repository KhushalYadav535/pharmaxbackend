import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', expenseController.list);
router.post('/', expenseController.create);
router.get('/:id', expenseController.getById);
router.put('/:id', expenseController.update);
router.patch('/:id/status', expenseController.updateStatus);
router.delete('/:id', expenseController.delete);

export default router;
