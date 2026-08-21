import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { locationController } from '../controllers/location.controller';

const router = Router();
router.use(authenticate);
router.get('/', locationController.list);
router.get('/:id', locationController.getById);
router.post('/', locationController.create);
router.put('/:id', locationController.update);
router.patch('/:id/deactivate', locationController.deactivate);
export default router;
