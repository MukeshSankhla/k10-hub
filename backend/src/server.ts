import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { env, corsOrigins } from './config/env';
import { initDatabase } from './db/init';

import healthRoutes from './api/routes/health';
import projectRoutes from './api/routes/projects';
import categoryRoutes from './api/routes/categories';
import authRoutes from './api/routes/auth';
import adminRoutes from './api/routes/admin';
import communityRoutes from './api/routes/community';
import notificationRoutes from './api/routes/notifications';

import rateLimit from 'express-rate-limit';
import compression from 'compression';

const app = express();

// Trust reverse proxy if running in production
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security, compression, and utility middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(compression() as any);
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// General API Rate Limiting (skipped in development for localhost testing)
const isDev = env.NODE_ENV === 'development';
const isLocalhost = (ip?: string) => !ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50000 : 1200,
  skip: (req) => isDev || isLocalhost(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP. Please try again later.',
  },
});
app.use('/api', globalLimiter as any);

// Authentication Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 120,
  skip: (req) => isDev || isLocalhost(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AUTH_RATE_LIMITED',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/auth', authLimiter as any, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/notifications', notificationRoutes);

// Static frontend build serving (production / single-server mode)
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      // Hashed Vite assets are immutable and can be cached long-term
      if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  const status = typeof err.status === 'number' ? err.status : 500;
  const isSafeClientError = status < 500;
  const isProd = env.NODE_ENV === 'production';

  res.status(status).json({
    error: err.code || (status === 429 ? 'TOO_MANY_REQUESTS' : 'INTERNAL_SERVER_ERROR'),
    message: isProd && !isSafeClientError
      ? 'An unexpected internal server error occurred'
      : (err.message || 'An unexpected error occurred'),
  });
});

let dbInitPromise: Promise<void> | null = null;
export function ensureDatabaseReady(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = initDatabase().catch((err) => {
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

// In serverless environments (e.g. Vercel), ensure DB tables are ready before handling requests
app.use(async (_req, _res, next) => {
  try {
    await ensureDatabaseReady();
    next();
  } catch (err) {
    next(err);
  }
});

let serverInstance: any = null;

async function start() {
  try {
    console.log('🔄 Initializing K10 Hub database tables...');
    await ensureDatabaseReady();

    serverInstance = app.listen(env.PORT, env.HOST, () => {
      console.log(`🚀 K10 Hub API server listening on http://${env.HOST}:${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down K10 Hub server...`);
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('✅ HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('⚠️ Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Only start listening when not running as a Vercel serverless function
if (!process.env.VERCEL) {
  start();
}

export default app;
