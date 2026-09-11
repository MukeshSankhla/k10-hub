import { Router, Request, Response } from 'express';
import { client } from '../../config/database';

const router = Router();
const startTime = Date.now();

router.get('/', async (_req: Request, res: Response) => {
  let dbStatus = 'ok';
  try {
    await client.execute('SELECT 1');
  } catch (err: any) {
    dbStatus = 'error: ' + (err.message || 'unknown');
  }

  const isHealthy = dbStatus === 'ok';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    database: dbStatus,
    service: 'K10 Hub API',
    version: '1.0.0',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  });
});

export default router;
