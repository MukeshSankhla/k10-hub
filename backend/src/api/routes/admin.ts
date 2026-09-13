import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, desc, and, like, or, sql, count } from 'drizzle-orm';
import { db } from '../../config/database';
import { users, authorApplications, projects, notifications, comments, projectLikes, projectBookmarks, flashLogs } from '../../db/schema';
import { requireAdmin, AuthRequest } from '../../middleware/auth';
import { env } from '../../config/env';
import { notificationService } from '../../services/NotificationService';
import { getSupabaseClient } from '../../services/supabase';

const router = Router();

// Apply admin protection to all routes in this router
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Platform user and creator statistics
 */
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const totalUsersResult = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersResult[0]?.count || 0;

    const roleCounts = await db
      .select({
        role: users.role,
        count: count(),
      })
      .from(users)
      .groupBy(users.role);

    const pendingAppsResult = await db
      .select({ count: count() })
      .from(authorApplications)
      .where(eq(authorApplications.status, 'pending'));
    const pendingApplications = pendingAppsResult[0]?.count || 0;

    const totalProjectsResult = await db.select({ count: count() }).from(projects);
    const totalProjects = totalProjectsResult[0]?.count || 0;

    const rolesMap: Record<string, number> = { user: 0, author: 0, admin: 0 };
    for (const row of roleCounts) {
      rolesMap[row.role] = row.count;
    }

    return res.json({
      totalUsers,
      usersByRole: rolesMap,
      pendingApplications,
      totalProjects,
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({ error: 'STATS_ERROR', message: error.message });
  }
});

/**
 * GET /api/admin/users
 * Paginated user listing with search and filters
 */
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 15));
    const offset = (page - 1) * pageSize;
    const rawSearch = (req.query.search as string)?.trim().slice(0, 100);
    const roleFilter = req.query.role as string;
    const statusFilter = req.query.status as string;

    const conditions = [];

    if (rawSearch) {
      // Escape special SQLite LIKE characters to prevent wildcard injection
      const escapedSearch = rawSearch.replace(/[%_\\]/g, '\\$&');
      conditions.push(
        or(
          like(users.name, `%${escapedSearch}%`),
          like(users.email, `%${escapedSearch}%`),
          like(users.userKey, `%${escapedSearch}%`)
        )
      );
    }

    if (roleFilter && ['user', 'author', 'admin'].includes(roleFilter)) {
      conditions.push(eq(users.role, roleFilter as any));
    }

    if (statusFilter && ['active', 'suspended'].includes(statusFilter)) {
      conditions.push(eq(users.status, statusFilter as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const userList = await db.query.users.findMany({
      where: whereClause,
      limit: pageSize,
      offset,
      orderBy: [desc(users.createdAt)],
    });

    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);
    const total = totalResult[0]?.count || 0;

    return res.json({
      data: userList,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error('Error listing admin users:', error);
    return res.status(500).json({ error: 'USERS_ERROR', message: error.message });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Change a user's role (user, author, admin)
 */
const updateRoleSchema = z.object({
  role: z.enum(['user', 'author', 'admin']),
});

router.patch('/users/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id);
    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid user ID' });
    }

    const parseResult = updateRoleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid role' });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    const newRole = parseResult.data.role;

    // Prevent administrator self-demotion
    if (req.user?.id === targetUserId && newRole !== 'admin') {
      return res.status(400).json({
        error: 'SELF_DEMOTION',
        message: 'Administrators cannot demote their own account.',
      });
    }

    // Protect primary configured system admins
    const adminList = env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase());
    if (adminList.includes(targetUser.email.toLowerCase()) && newRole !== 'admin') {
      return res.status(400).json({
        error: 'PROTECTED_ADMIN',
        message: 'This user is configured in ADMIN_EMAILS and cannot be demoted.',
      });
    }

    const now = Math.floor(Date.now() / 1000);

    await db
      .update(users)
      .set({
        role: newRole,
        updatedAt: now,
      })
      .where(eq(users.id, targetUserId));

    const updated = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    return res.json({
      success: true,
      message: `User role successfully updated to ${newRole}`,
      user: updated,
    });
  } catch (error: any) {
    console.error('Error updating role:', error);
    return res.status(500).json({ error: 'ROLE_UPDATE_ERROR', message: error.message });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Activate or Suspend a user
 */
const updateStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

router.patch('/users/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id);
    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid user ID' });
    }

    if (req.user?.id === targetUserId) {
      return res.status(400).json({
        error: 'SELF_SUSPENSION',
        message: 'Administrators cannot suspend their own account.',
      });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    const parseResult = updateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid status' });
    }

    // Protect primary configured system admins against suspension
    const adminList = env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase());
    if (adminList.includes(targetUser.email.toLowerCase()) && parseResult.data.status === 'suspended') {
      return res.status(400).json({
        error: 'PROTECTED_ADMIN',
        message: 'System administrators configured in ADMIN_EMAILS cannot be suspended.',
      });
    }

    const now = Math.floor(Date.now() / 1000);
    await db
      .update(users)
      .set({
        status: parseResult.data.status,
        updatedAt: now,
      })
      .where(eq(users.id, targetUserId));

    // Synchronize suspension status to Supabase Auth ban
    if (targetUser.supabaseUid) {
      const supabase = getSupabaseClient();
      if (supabase && (supabase.auth as any).admin) {
        try {
          await (supabase.auth as any).admin.updateUserById(targetUser.supabaseUid, {
            ban_duration: parseResult.data.status === 'suspended' ? '876600h' : 'none',
          });
        } catch (sbErr) {
          console.warn(`Could not sync ban status for user ${targetUser.supabaseUid} to Supabase:`, sbErr);
        }
      }
    }

    return res.json({
      success: true,
      message: `User status changed to ${parseResult.data.status}`,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'STATUS_UPDATE_ERROR', message: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Permanently delete user from everywhere:
 * - Supabase Auth (removes user auth account and revokes active sessions)
 * - SQLite Database (cascades notifications, applications, comments, bookmarks, likes, flash logs, projects, and user)
 */
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id);
    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid user ID' });
    }

    if (req.user?.id === targetUserId) {
      return res.status(400).json({
        error: 'SELF_DELETION',
        message: 'Administrators cannot delete their own account.',
      });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    // Protect primary configured system admins against deletion
    const adminList = env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase());
    if (adminList.includes(targetUser.email.toLowerCase())) {
      return res.status(400).json({
        error: 'PROTECTED_ADMIN',
        message: 'System administrators configured in ADMIN_EMAILS cannot be deleted.',
      });
    }

    const uidStr = String(targetUserId);
    const sbUid = targetUser.supabaseUid;
    const userEmail = targetUser.email.toLowerCase();

    // 1. Delete from Supabase Auth
    if (sbUid) {
      const supabase = getSupabaseClient();
      if (supabase && (supabase.auth as any).admin) {
        try {
          await (supabase.auth as any).admin.deleteUser(sbUid);
        } catch (sbErr) {
          console.warn(`Could not delete user ${sbUid} from Supabase Auth:`, sbErr);
        }
      }
    }

    // 2. Cascade delete from local database tables
    // Remove notifications for this user
    await db.delete(notifications).where(eq(notifications.userId, targetUserId));

    // Remove or reassign author applications
    await db.delete(authorApplications).where(eq(authorApplications.userId, targetUserId));
    await db.update(authorApplications).set({ reviewedBy: null }).where(eq(authorApplications.reviewedBy, targetUserId));

    // Remove user bookmarks
    await db.delete(projectBookmarks).where(
      or(
        eq(projectBookmarks.userId, uidStr),
        eq(projectBookmarks.userId, sbUid)
      )
    );

    // Remove user likes
    await db.delete(projectLikes).where(
      or(
        eq(projectLikes.userId, uidStr),
        eq(projectLikes.userId, sbUid),
        eq(projectLikes.userEmail, userEmail)
      )
    );

    // Remove user flash logs
    await db.delete(flashLogs).where(
      or(
        eq(flashLogs.userId, uidStr),
        eq(flashLogs.userId, sbUid)
      )
    );

    // Remove user comments
    await db.delete(comments).where(
      or(
        eq(comments.authorId, uidStr),
        eq(comments.authorId, sbUid),
        eq(comments.authorEmail, userEmail)
      )
    );

    // Delete projects authored by this user
    await db.delete(projects).where(
      or(
        eq(projects.authorId, uidStr),
        eq(projects.authorId, sbUid),
        eq(projects.authorEmail, userEmail)
      )
    );

    // Finally, remove the user record
    await db.delete(users).where(eq(users.id, targetUserId));

    return res.json({
      success: true,
      message: `User "${targetUser.name}" (${targetUser.email}) and all associated records were permanently deleted.`,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: 'USER_DELETE_ERROR', message: error.message || 'Failed to delete user' });
  }
});

/**
 * GET /api/admin/author-applications
 * List author applications
 */
router.get('/author-applications', async (req: AuthRequest, res: Response) => {
  try {
    const statusFilter = req.query.status as string;

    if (statusFilter === 'demoted') {
      const applications = await db.query.authorApplications.findMany({
        where: eq(authorApplications.status, 'approved'),
        orderBy: [desc(authorApplications.createdAt)],
        with: {
          user: true,
          reviewer: true,
        },
      });
      const demotedApps = applications.filter((a) => a.user && a.user.role === 'user');
      return res.json({ data: demotedApps });
    }

    if (statusFilter === 'approved') {
      const applications = await db.query.authorApplications.findMany({
        where: eq(authorApplications.status, 'approved'),
        orderBy: [desc(authorApplications.createdAt)],
        with: {
          user: true,
          reviewer: true,
        },
      });
      const activeApproved = applications.filter((a) => !a.user || a.user.role !== 'user');
      return res.json({ data: activeApproved });
    }

    const condition =
      statusFilter && ['pending', 'rejected'].includes(statusFilter)
        ? eq(authorApplications.status, statusFilter as any)
        : undefined;

    const applications = await db.query.authorApplications.findMany({
      where: condition,
      orderBy: [desc(authorApplications.createdAt)],
      with: {
        user: true,
        reviewer: true,
      },
    });

    return res.json({ data: applications });
  } catch (error: any) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({ error: 'APPS_ERROR', message: error.message });
  }
});

/**
 * POST /api/admin/author-applications/:id/approve
 * Approve application -> Upgrade user to Author -> Create author record
 */
router.post('/author-applications/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid application ID' });
    }

    const appRecord = await db.query.authorApplications.findFirst({
      where: eq(authorApplications.id, applicationId),
      with: { user: true },
    });

    if (!appRecord) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found' });
    }

    const applicant = appRecord.user;
    const now = Math.floor(Date.now() / 1000);

    // Update user role to author
    await db
      .update(users)
      .set({
        role: 'author',
        updatedAt: now,
      })
      .where(eq(users.id, applicant.id));

    // Update application status
    await db
      .update(authorApplications)
      .set({
        status: 'approved',
        reviewedBy: req.user!.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(authorApplications.id, applicationId));

    notificationService.notifyAuthorApplication(applicationId, 'approved').catch(() => {});

    return res.json({
      success: true,
      message: `Applicant ${applicant.name} approved as Author!`,
    });
  } catch (error: any) {
    console.error('Error approving application:', error);
    return res.status(500).json({ error: 'APPROVE_ERROR', message: error.message });
  }
});

/**
 * POST /api/admin/author-applications/:id/reject
 * Reject application with optional feedback
 */
const rejectSchema = z.object({
  adminNotes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

router.post('/author-applications/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid application ID' });
    }

    const parseResult = rejectSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: parseResult.error.errors[0]?.message || 'Invalid notes' });
    }
    const { adminNotes } = parseResult.data;
    const now = Math.floor(Date.now() / 1000);

    await db
      .update(authorApplications)
      .set({
        status: 'rejected',
        adminNotes: adminNotes || null,
        reviewedBy: req.user!.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(authorApplications.id, applicationId));

    notificationService.notifyAuthorApplication(applicationId, 'rejected', adminNotes).catch(() => {});

    return res.json({
      success: true,
      message: 'Author application has been marked as rejected.',
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'REJECT_ERROR', message: error.message });
  }
});

export default router;
