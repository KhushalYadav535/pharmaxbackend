import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { areaController } from '../controllers/area.controller';

const router = Router();
router.use(authenticate);
router.get('/', areaController.list);
router.get('/:id', areaController.getById);
router.post('/', areaController.create);
router.put('/:id', areaController.update);
router.patch('/:id/deactivate', areaController.deactivate);
export default router;
