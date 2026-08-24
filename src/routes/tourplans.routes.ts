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

export default router;
