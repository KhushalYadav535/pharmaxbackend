import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/mr', async (req, res) => {
  // TODO: Replace with real aggregation from database
  res.json({
    success: true,
    data: {
      kpis: [
        { label: 'Dr Coverage', value: '45%', target: '85%', progress: 45, icon: 'people-outline', color: '#0F9D58' },
        { label: 'Call Avg', value: '6', target: '10/day', progress: 60, icon: 'call-outline', color: '#3B82F6' },
        { label: 'PCPM', value: '₹1.1L', target: '₹1.5L', progress: 73, icon: 'trending-up-outline', color: '#8B5CF6' },
        { label: 'Samples', value: '42', target: '60', progress: 70, icon: 'gift-outline', color: '#F59E0B' },
      ],
      tour: { area: 'Andheri West', doctorsPlanned: 12, status: 'in-progress' },
      aiInsight: 'Consider visiting Dr. Sharma today, as his detailing response was positive last week.',
    }
  });
});

export default router;
