import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { dailyReportController } from '../controllers/dailyreport.controller';

const router = Router();
router.use(authenticate);
router.get('/', dailyReportController.list);
router.get('/:id', dailyReportController.getById);
router.post('/', dailyReportController.create);
router.put('/:id', dailyReportController.update);
export default router;
