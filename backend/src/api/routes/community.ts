import { Router, Response, NextFunction } from 'express';
import { communityService } from '../../services/CommunityService';
import { requireAuth, optionalAuth, AuthRequest } from '../../middleware/auth';

const router = Router();

// ─── LIKES ───────────────────────────────────────────────────────────────────

// GET /api/community/likes/:projectId
router.get('/likes/:projectId', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const userId = req.user ? String(req.user.id) : undefined;
    const data = await communityService.getLikes(projectId, userId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/community/likes/:projectId/toggle
router.post('/likes/:projectId/toggle', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const data = await communityService.toggleLike(projectId, req.user!);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ─── BOOKMARKS ───────────────────────────────────────────────────────────────

// GET /api/community/bookmarks
router.get('/bookmarks', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bookmarks = await communityService.getBookmarks(String(req.user!.id), req.user!.supabaseUid);
    res.json({ bookmarks });
  } catch (error) {
    next(error);
  }
});

// POST /api/community/bookmarks/:projectId/toggle
router.post('/bookmarks/:projectId/toggle', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const data = await communityService.toggleBookmark(projectId, req.user!);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ─── COMMENTS ────────────────────────────────────────────────────────────────

// GET /api/community/comments/:projectId
router.get('/comments/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const comments = await communityService.getComments(projectId);
    res.json({ comments });
  } catch (error) {
    next(error);
  }
});

// POST /api/community/comments/:projectId
router.post('/comments/:projectId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { content, parentId } = req.body;
    const comment = await communityService.addComment(projectId, { content, parentId }, req.user!);
    res.status(201).json({ success: true, comment });
  } catch (error) {
    next(error);
  }
});

// POST /api/community/comments/:commentId/vote
router.post('/comments/:commentId/vote', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const { voteType } = req.body; // 'up' | 'down' | 'none'
    const result = await communityService.voteComment(commentId, voteType || 'up', req.user!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/community/comments/:commentId
router.delete('/comments/:commentId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const result = await communityService.deleteComment(commentId, req.user!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
