import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, AuthRequest } from '../../middleware/auth';
import { notificationService } from '../../services/NotificationService';

const router = Router();

// ─── Query Schema ─────────────────────────────────────────────────────────────
const listNotificationsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const broadcastSchema = z.object({
  icon: z.string().default('bell'),
  title: z.string().min(1, 'Title is required').max(120),
  message: z.string().min(1, 'Message is required').max(500),
  url: z.string().optional(),
  target: z.enum(['all', 'users', 'authors', 'specific']).default('all'),
  targetUserIds: z.array(z.number()).optional(),
});

// GET /api/notifications (User's notifications)
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = listNotificationsSchema.parse(req.query);
    const userId = Number(req.user!.id);
    const result = await notificationService.getUserNotifications(userId, limit, offset);
    res.json({
      data: result.notifications,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/unread-count (Quick counter check)
router.get('/unread-count', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user!.id);
    const unreadCount = await notificationService.getUnreadCount(userId);
    res.json({ unreadCount });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/:id/read (Mark single as read)
router.post('/:id/read', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.user!.id);
    await notificationService.markAsRead(userId, id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/read-all (Mark all user's notifications as read)
router.post('/read-all', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user!.id);
    await notificationService.markAllAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/:id (Delete notification)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.user!.id);
    await notificationService.deleteNotification(userId, id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/broadcast (Admin broadcast custom notification)
router.post('/broadcast', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payload = broadcastSchema.parse(req.body);
    const result = await notificationService.broadcastNotification(payload);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
