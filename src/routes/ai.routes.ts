import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/summarize-visit', aiController.summarizeVisit);
router.post('/next-best-action', aiController.nextBestAction);
router.post('/chat', aiController.chat);
router.post('/daily-plan', aiController.dailyPlan);
router.post('/eod-report', aiController.eodReport);

export default router;
