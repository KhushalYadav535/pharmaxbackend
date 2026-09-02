import { Router } from 'express';
import { visitController } from '../controllers/visit.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';

const router = Router();
router.use(authenticate);

router.get('/',                                                    visitController.list);
router.get('/today-stats',                                         visitController.todayStats);
router.get('/team',             requireManager,                    visitController.listTeam);
router.get('/team/members',     requireManager,                    visitController.getTeamMembers);
router.get('/:id',                                                 visitController.getById);
router.post('/',                auditLog('CREATE',  'Visit'),      visitController.create);
router.patch('/:id/navigate',   auditLog('NAVIGATE','Visit'),      visitController.navigate);
router.patch('/:id/check-in',   auditLog('CHECK_IN','Visit'),      visitController.checkIn);
router.patch('/:id/prepare',    auditLog('PREPARE','Visit'),       visitController.prepare);
router.patch('/:id/engage',     auditLog('ENGAGE','Visit'),        visitController.engage);
router.patch('/:id/detail',     auditLog('DETAIL','Visit'),        visitController.detail);
router.patch('/:id/check-out',  auditLog('CHECK_OUT','Visit'),     visitController.checkOut);
router.patch('/:id/submit-report', auditLog('SUBMIT_REPORT','Visit'), visitController.submitReport);
router.patch('/:id/next-call',  auditLog('NEXT_CALL','Visit'),     visitController.nextCall);
router.patch('/:id/mark-missed', auditLog('MARK_MISSED','Visit'),  visitController.markMissed);
router.patch('/:id/notes',                                         visitController.updateNotes);
router.patch('/:id/approve',    requireManager, auditLog('APPROVE','Visit'), visitController.approve);
router.patch('/:id/reject',     requireManager, auditLog('REJECT', 'Visit'), visitController.reject);

export default router;
