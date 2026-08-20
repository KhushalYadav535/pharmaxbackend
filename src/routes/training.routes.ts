import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// List training modules (with user attempt info)
router.get('/modules', async (req, res) => {
  try {
    const { search } = req.query;
    const where: any = { isActive: true };
    if (search) where.title = { contains: search as string, mode: 'insensitive' };

    const modules = await prisma.trainingModule.findMany({
      where,
      include: {
        quizzes: { select: { id: true, question: true, options: true, correctAnswer: true, explanation: true } },
        attempts: {
          where: { userId: req.user!.userId },
          orderBy: { completedAt: 'desc' },
          take: 1,
          select: { id: true, score: true, totalScore: true, passed: true, completedAt: true },
        },
      },
    });
    res.json({ success: true, data: modules });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Single module
router.get('/modules/:id', async (req, res) => {
  try {
    const module = await prisma.trainingModule.findUnique({
      where: { id: req.params.id as string },
      include: {
        quizzes: true,
        attempts: { where: { userId: req.user!.userId }, orderBy: { completedAt: 'desc' }, take: 1 },
      },
    });
    if (!module) return res.status(404).json({ success: false, message: 'Module not found' });
    res.json({ success: true, data: module });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Submit quiz attempt
router.post('/modules/:id/attempt', async (req, res) => {
  try {
    const { answers } = req.body; // array of selected answer indices
    const module = await prisma.trainingModule.findUnique({
      where: { id: req.params.id as string },
      include: { quizzes: true },
    });
    if (!module) return res.status(404).json({ success: false, message: 'Module not found' });

    const totalScore = module.quizzes.length;
    const score = module.quizzes.reduce((acc: number, q: any, i: number) => {
      return acc + (answers[i] === q.correctAnswer ? 1 : 0);
    }, 0);
    const passed = totalScore > 0 ? (score / totalScore) >= 0.7 : true;

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: req.user!.userId,
        moduleId: req.params.id as string,
        score,
        totalScore,
        passed,
        completedAt: new Date(),
      },
    });
    res.status(201).json({ success: true, data: { attempt, score, totalScore, passed } });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// My progress
router.get('/my-progress', async (req, res) => {
  try {
    const [totalModules, myAttempts] = await Promise.all([
      prisma.trainingModule.count({ where: { isActive: true } }),
      prisma.quizAttempt.findMany({ where: { userId: req.user!.userId }, select: { moduleId: true, passed: true, score: true, totalScore: true } }),
    ]);

    const passedModules = new Set(myAttempts.filter((a) => a.passed).map((a) => a.moduleId)).size;
    const avgScore = myAttempts.length > 0
      ? Math.round(myAttempts.reduce((s, a) => s + (a.totalScore > 0 ? (a.score / a.totalScore) * 100 : 0), 0) / myAttempts.length)
      : 0;

    res.json({
      success: true,
      data: { totalModules, completed: passedModules, pending: totalModules - passedModules, completionRate: totalModules > 0 ? Math.round((passedModules / totalModules) * 100) : 0, avgScore },
    });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
