import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { mrUsageController } from '../controllers/mr-usage.controller';

const router = Router();
router.use(authenticate);

// ─── MR App Usage & Login Reports API ────────────────────────────────────────
// 1. Team overview / list of all MRs with aggregated metrics
router.get('/', mrUsageController.getOverview);

// 2. Export Team overview to CSV
router.get('/export', mrUsageController.exportOverviewCSV);

// 3. Individual MR report drill-down (day-by-day & full session log history)
router.get('/:mrId', mrUsageController.getIndividualReport);

// 4. Export Individual MR session logs to CSV
router.get('/:mrId/export', mrUsageController.exportIndividualCSV);

export default router;
