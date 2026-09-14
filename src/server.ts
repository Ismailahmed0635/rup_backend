import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import logger from './utils/logger';
import authRoutes from '../api/routes/auth.routes';
import storeRoutes from '../api/routes/store.routes';
import creditRoutes from '../api/routes/credit.routes';
import tryonRoutes from '../api/routes/tryon.routes';
import bkashRoutes from '../api/routes/bkash.routes';
import bankRoutes from '../api/routes/bank.routes';
import paymentRoutes from '../api/routes/payment.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// Parse JSON bodies (25mb: base64 photo uploads inflate ~33% over the 10 MB file limit)
app.use(express.json({ limit: '25mb' }));

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));

// HTTP request logging
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }));

// Rate limiting - default: 100 requests per 15 min per IP (health check excluded)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Health check endpoint (no auth, no rate limit)
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Widget static files (no auth required) - cached so merchants' pages load fast.
// Skip in serverless (Vercel) — no persistent file system available.
if (!process.env.VERCEL) {
  const widgetDistCandidates = [
    process.env.WIDGET_DIST_PATH,
    path.resolve(__dirname, '../../../widget/dist'),
    path.resolve(__dirname, '../../../../widget/dist'),
  ].filter(Boolean) as string[];

  const widgetDist =
    widgetDistCandidates.find((candidate) => fs.existsSync(candidate)) ||
    widgetDistCandidates[widgetDistCandidates.length - 1];

  if (widgetDist && fs.existsSync(widgetDist)) {
    app.use('/widget', express.static(widgetDist, {
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=300');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    }));
  }
}

// Auth routes (no auth required)
app.use('/api/auth', authRoutes);

// bKash payment routes
app.use('/api/bkash', bkashRoutes);

// Bank payment routes
app.use('/api/bank', bankRoutes);

// Payment routes (bkash/nagad/stripe)
app.use('/api/payments', paymentRoutes);

// Store/credit/tryon routes authenticate per-route inside their routers
// (do NOT mount authenticate here as well - that ran auth twice per request)
app.use('/api/stores', storeRoutes);

// Credit routes (authenticated)
app.use('/api/credits', creditRoutes);

// Try-On routes (authenticated)
app.use('/api/tryon', tryonRoutes);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    code: 'ERR_404',
  });
});

// Global error handler
app.use(errorMiddleware);

export default app;