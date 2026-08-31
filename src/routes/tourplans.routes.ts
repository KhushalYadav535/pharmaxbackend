import { Router } from 'express';
import { tourPlanController } from '../controllers/tourplan.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', tourPlanController.list);
router.post('/', tourPlanController.create);
router.get('/:id', tourPlanController.getById);
router.put('/:id', tourPlanController.update);
router.patch('/:id/status', tourPlanController.updateStatus);
router.delete('/:id', tourPlanController.delete);

// Monthly TP Endpoints
router.post('/:id/days', tourPlanController.addDay);
router.post('/:id/days/:dayId/visits', tourPlanController.bulkAddVisits);
router.post('/:id/copy-day', tourPlanController.copyDay);
router.post('/:id/copy-month', tourPlanController.copyMonth);
router.get('/:id/coverage', tourPlanController.getCoverage);

export default router;
