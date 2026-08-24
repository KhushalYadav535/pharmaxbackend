import { Router } from 'express';
import { stockReportController } from '../controllers/stockreport.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', stockReportController.list);
router.post('/', stockReportController.create);
router.get('/:id', stockReportController.getById);
router.put('/:id', stockReportController.update);
router.delete('/:id', stockReportController.delete);

export default router;
