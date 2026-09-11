import { Router, Request, Response, NextFunction } from 'express';
import { categoryService } from '../../services/CategoryService';

const router = Router();

// GET /api/categories
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.getCategories();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/:slug
router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categoryService.getCategoryBySlug(req.params.slug);

    if (!category) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Category "${req.params.slug}" not found`,
        statusCode: 404,
      });
    }

    return res.json({ data: category });
  } catch (error) {
    next(error);
  }
});

export default router;
