import { Router } from 'express';
import { surveyController } from '../controllers/survey.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', surveyController.list);
router.post('/', surveyController.create);
router.get('/:id', surveyController.getById);
router.put('/:id', surveyController.update);
router.delete('/:id', surveyController.delete);

export default router;
