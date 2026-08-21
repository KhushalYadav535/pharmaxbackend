import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { stockReportController } from '../controllers/stockreport.controller';

const router = Router();
router.use(authenticate);
router.get('/', stockReportController.list);
router.get('/:id', stockReportController.getById);
router.post('/', stockReportController.create);
router.put('/:id', stockReportController.update);
export default router;
