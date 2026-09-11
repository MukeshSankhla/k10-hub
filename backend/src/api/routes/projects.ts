import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { projectService } from '../../services/ProjectService';
import { requireAuth, requireAdmin, optionalAuth, AuthRequest } from '../../middleware/auth';

const router = Router();

// ─── Query validation schemas ─────────────────────────────────────────────────
const listProjectsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  type: z.string().optional(),
  difficulty: z.coerce.number().optional(),
  featured: z.coerce.boolean().optional(),
  status: z.string().optional(),
  visibility: z.string().optional(),
  authorId: z.string().optional(),
  search: z.string().optional(),
  tag: z.string().optional(),
});

// GET /api/projects
router.get('/', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = listProjectsSchema.parse(req.query);

    const { data, total } = await projectService.getProjects(
      {
        type: query.type,
        difficulty: query.difficulty,
        isFeatured: query.featured,
        status: query.status,
        visibility: query.visibility,
        authorId: query.authorId,
        search: query.search,
        tag: query.tag,
      },
      { page: query.page, pageSize: query.pageSize },
      req.user
    );

    res.json({
      data,
      meta: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        hasNextPage: query.page * query.pageSize < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/featured
router.get('/featured', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectService.getFeaturedProjects(6);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await projectService.getProjectById(id);

    if (!project) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Project "${id}" not found`,
        statusCode: 404,
      });
    }

    // Increment view count asynchronously
    projectService.incrementViewCount(id).catch(() => {});

    return res.json({ data: project });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects (Create project)
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    if (!payload.title || !payload.title.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Project title is required' });
    }

    const saved = await projectService.saveProject(payload, req.user);
    res.status(201).json({ success: true, data: saved });
  } catch (error: any) {
    next(error);
  }
});

// PUT /api/projects/:id (Update project)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body, id };

    const saved = await projectService.saveProject(payload, req.user);
    res.json({ success: true, data: saved });
  } catch (error: any) {
    next(error);
  }
});

// DELETE /api/projects/:id (Delete project)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await projectService.deleteProject(id, req.user);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

// POST /api/projects/:id/flash (Record a flash count)
router.post('/:id/flash', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user ? String(req.user.id) : undefined;
    const newCount = await projectService.incrementFlashCount(id, userId);
    res.json({ success: true, flashCount: newCount });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:id/feature (Toggle featured status)
router.post('/:id/feature', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const isFeatured = await projectService.toggleFeatured(id);
    res.json({ success: true, isFeatured });
  } catch (error) {
    next(error);
  }
});

export default router;
