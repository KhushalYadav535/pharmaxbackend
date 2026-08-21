import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { surveyController } from '../controllers/survey.controller';

const router = Router();
router.use(authenticate);
router.get('/', surveyController.list);
router.get('/:id', surveyController.getById);
router.post('/', surveyController.create);
router.put('/:id', surveyController.update);
export default router;
