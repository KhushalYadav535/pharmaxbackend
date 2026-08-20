import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler, notFound } from './middlewares/error.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import doctorRoutes from './routes/doctors.routes';
import hospitalRoutes from './routes/hospitals.routes';
import retailerRoutes from './routes/retailers.routes';
import distributorRoutes from './routes/distributors.routes';
import visitRoutes from './routes/visits.routes';
import orderRoutes from './routes/orders.routes';
import expenseRoutes from './routes/expenses.routes';
import analyticsRoutes from './routes/analytics.routes';
import aiRoutes from './routes/ai.routes';
import attendanceRoutes from './routes/attendance.routes';
import samplesRoutes from './routes/samples.routes';
import trainingRoutes from './routes/training.routes';
import tourPlanRoutes from './routes/tourplans.routes';
import leavesRoutes from './routes/leaves.routes';
import approvalsRoutes from './routes/approvals.routes';
import contentRoutes from './routes/content.routes';
import schemesRoutes from './routes/schemes.routes';
import retailAuditRoutes from './routes/retail-audit.routes';

const app = express();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ─────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// ─── Static file serving for uploads ─────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_DIR)));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/doctors`, doctorRoutes);
app.use(`${API}/hospitals`, hospitalRoutes);
app.use(`${API}/retailers`, retailerRoutes);
app.use(`${API}/distributors`, distributorRoutes);
app.use(`${API}/visits`, visitRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/expenses`, expenseRoutes);
app.use(`${API}/analytics`, analyticsRoutes);
app.use(`${API}/ai`, aiRoutes);
app.use(`${API}/attendance`, attendanceRoutes);
app.use(`${API}/samples`, samplesRoutes);
app.use(`${API}/training`, trainingRoutes);
app.use(`${API}/tour-plans`, tourPlanRoutes);
app.use(`${API}/leaves`, leavesRoutes);
app.use(`${API}/approvals`, approvalsRoutes);
app.use(`${API}/content`, contentRoutes);
app.use(`${API}/schemes`, schemesRoutes);
app.use(`${API}/retail-audit`, retailAuditRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
