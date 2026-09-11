import { eq, desc, and, inArray, count } from 'drizzle-orm';
import { db } from '../config/database';
import { notifications, users, projects, comments, authorApplications } from '../db/schema';
import { DbUser } from '../middleware/auth';

export interface CreateNotificationParams {
  userId: number;
  type: string;
  title: string;
  message: string;
  icon?: string;
  url?: string;
  data?: any;
}

export interface BroadcastNotificationParams {
  icon?: string;
  title: string;
  message: string;
  url?: string;
  target: 'all' | 'users' | 'authors' | 'specific';
  targetUserIds?: number[];
}

function truncate(text: string, maxLen = 60): string {
  if (!text) return '';
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > maxLen ? clean.slice(0, maxLen - 3) + '...' : clean;
}

export class NotificationService {
  /**
   * Creates an individual notification for a user.
   */
  async createNotification(params: CreateNotificationParams) {
    if (!params.userId) return null;

    const [created] = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        icon: params.icon || 'bell',
        url: params.url || null,
        data: params.data ? JSON.stringify(params.data) : null,
        isRead: false,
      })
      .returning();

    return created;
  }

  /**
   * Retrieves notifications for a user with unread count.
   */
  async getUserNotifications(userId: number, limit = 50, offset = 0) {
    const rows = await db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      limit,
      offset,
      orderBy: [desc(notifications.createdAt)],
    });

    const [unreadRes] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    const unreadCount = unreadRes ? Number(unreadRes.count) : 0;

    return {
      notifications: rows,
      unreadCount,
    };
  }

  /**
   * Returns unread notification count for a user.
   */
  async getUnreadCount(userId: number): Promise<number> {
    const [res] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return res ? Number(res.count) : 0;
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(userId: number, notificationId: number) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

    return { success: true };
  }

  /**
   * Marks all notifications as read for a user.
   */
  async markAllAsRead(userId: number) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));

    return { success: true };
  }

  /**
   * Deletes a single notification.
   */
  async deleteNotification(userId: number, notificationId: number) {
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

    return { success: true };
  }

  /**
   * Admin Broadcast: Sends custom notifications to users, authors, or all.
   */
  async broadcastNotification(params: BroadcastNotificationParams) {
    let targetUsers: { id: number }[] = [];

    if (params.target === 'specific' && Array.isArray(params.targetUserIds) && params.targetUserIds.length > 0) {
      targetUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, params.targetUserIds));
    } else if (params.target === 'authors') {
      targetUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'author'), eq(users.status, 'active')));
    } else if (params.target === 'users') {
      targetUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'user'), eq(users.status, 'active')));
    } else {
      // 'all'
      targetUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.status, 'active'));
    }

    if (targetUsers.length === 0) {
      return { count: 0, message: 'No matching recipients found.' };
    }

    const records = targetUsers.map((u) => ({
      userId: u.id,
      type: 'custom',
      title: params.title.trim(),
      message: params.message.trim(),
      icon: params.icon || 'bell',
      url: params.url ? params.url.trim() : null,
      isRead: false,
    }));

    // Insert in batches of 100
    const chunkSize = 100;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await db.insert(notifications).values(chunk);
    }

    return { count: records.length, message: `Successfully broadcasted to ${records.length} user(s).` };
  }

  // ─── Automated Notification Triggers ────────────────────────────────────────

  /**
   * Helper: Resolves the author's DB user row from a project record.
   */
  private async findProjectAuthorUser(project: any): Promise<{ id: number; email: string } | null> {
    if (!project) return null;

    if (project.authorId) {
      const byId = await db.query.users.findFirst({
        where: eq(users.id, Number(project.authorId)),
      });
      if (byId) return byId;

      const byUid = await db.query.users.findFirst({
        where: eq(users.supabaseUid, String(project.authorId)),
      });
      if (byUid) return byUid;
    }

    if (project.authorEmail) {
      const byEmail = await db.query.users.findFirst({
        where: eq(users.email, project.authorEmail.trim().toLowerCase()),
      });
      if (byEmail) return byEmail;
    }

    return null;
  }

  /**
   * Trigger 1: Flash Milestone (10, 50, 100, 1000 flashes)
   */
  async checkFlashMilestone(projectId: string, newCount: number) {
    const MILESTONES = [10, 50, 100, 1000];
    if (!MILESTONES.includes(newCount)) return;

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return;

    const authorUser = await this.findProjectAuthorUser(project);
    if (!authorUser) return;

    await this.createNotification({
      userId: authorUser.id,
      type: 'milestone_flash',
      title: `⚡ Flash Milestone: ${newCount} Flashes!`,
      message: `Congratulations! Your project "${project.title}" just crossed ${newCount} successful flashes on UNIHIKER K10 hardware.`,
      icon: 'trophy',
      url: `/project/${project.id}`,
      data: { projectId: project.id, milestone: newCount },
    });
  }

  /**
   * Trigger 2a: Project Like
   */
  async notifyProjectLike(projectId: string, likerUser: DbUser) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return;

    const authorUser = await this.findProjectAuthorUser(project);
    if (!authorUser || authorUser.id === likerUser.id) return;

    await this.createNotification({
      userId: authorUser.id,
      type: 'project_like',
      title: `❤️ New Like on "${project.title}"`,
      message: `${likerUser.name} liked your project.`,
      icon: 'heart',
      url: `/project/${project.id}`,
      data: { projectId: project.id, likerId: likerUser.id },
    });
  }

  /**
   * Trigger 2b: Top-level Comment on Project
   */
  async notifyComment(projectId: string, comment: any, commenterUser: DbUser) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return;

    const authorUser = await this.findProjectAuthorUser(project);
    if (!authorUser || authorUser.id === commenterUser.id) return;

    await this.createNotification({
      userId: authorUser.id,
      type: 'project_comment',
      title: `💬 New Comment on "${project.title}"`,
      message: `${commenterUser.name} wrote: "${truncate(comment.content, 70)}"`,
      icon: 'message-square',
      url: `/project/${project.id}#comment-${comment.id}`,
      data: { projectId: project.id, commentId: comment.id },
    });
  }

  /**
   * Trigger 3: Looped / Nested Comment Reply
   */
  async notifyCommentReply(projectId: string, parentComment: any, reply: any, replierUser: DbUser) {
    if (!parentComment) return;

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    const projectTitle = project?.title || 'a project';

    // Find parent comment's author
    let parentAuthorUser: any = null;
    if (parentComment.authorId) {
      parentAuthorUser = await db.query.users.findFirst({
        where: eq(users.id, Number(parentComment.authorId)),
      });
      if (!parentAuthorUser) {
        parentAuthorUser = await db.query.users.findFirst({
          where: eq(users.supabaseUid, String(parentComment.authorId)),
        });
      }
    }
    if (!parentAuthorUser && parentComment.authorEmail) {
      parentAuthorUser = await db.query.users.findFirst({
        where: eq(users.email, parentComment.authorEmail.trim().toLowerCase()),
      });
    }

    if (!parentAuthorUser || parentAuthorUser.id === replierUser.id) return;

    await this.createNotification({
      userId: parentAuthorUser.id,
      type: 'comment_reply',
      title: `↩️ Reply to your comment`,
      message: `${replierUser.name} replied to your comment on "${projectTitle}": "${truncate(reply.content, 70)}"`,
      icon: 'corner-down-right',
      url: `/project/${projectId}#comment-${reply.id}`,
      data: { projectId, parentCommentId: parentComment.id, replyId: reply.id },
    });
  }

  /**
   * Trigger 4: Author Application Approval or Rejection
   */
  async notifyAuthorApplication(applicationId: number, status: 'approved' | 'rejected', notes?: string) {
    const app = await db.query.authorApplications.findFirst({
      where: eq(authorApplications.id, applicationId),
    });
    if (!app || !app.userId) return;

    if (status === 'approved') {
      await this.createNotification({
        userId: app.userId,
        type: 'author_application',
        title: `🎉 Author Application Approved!`,
        message: `Congratulations! Your application to become a verified K10 Author has been approved. You now have publishing privileges!`,
        icon: 'award',
        url: `/profile`,
        data: { applicationId: app.id, status: 'approved' },
      });
    } else {
      await this.createNotification({
        userId: app.userId,
        type: 'author_application',
        title: `Author Application Update`,
        message: notes
          ? `Your author application was reviewed. Feedback: ${notes}`
          : `Your author application was reviewed and could not be approved at this time. You can re-apply later.`,
        icon: 'alert-circle',
        url: `/profile`,
        data: { applicationId: app.id, status: 'rejected' },
      });
    }
  }

  /**
   * Trigger 5: Project Publish Approval
   */
  async notifyProjectApproval(projectId: string) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return;

    const authorUser = await this.findProjectAuthorUser(project);
    if (!authorUser) return;

    await this.createNotification({
      userId: authorUser.id,
      type: 'project_approval',
      title: `🚀 Project Published & Approved!`,
      message: `Your project "${project.title}" has been verified by the editorial team and is now live in the public catalog!`,
      icon: 'check-circle',
      url: `/project/${project.id}`,
      data: { projectId: project.id },
    });
  }
}

export const notificationService = new NotificationService();
