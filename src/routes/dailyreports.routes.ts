import { Router } from 'express';
import { dailyReportController } from '../controllers/dailyreport.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', dailyReportController.list);
router.post('/', dailyReportController.create);
router.get('/:id', dailyReportController.getById);
router.put('/:id', dailyReportController.update);
router.delete('/:id', dailyReportController.delete);

export default router;
