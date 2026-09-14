import { eq, and, or, desc, asc, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { comments, projectLikes, projectBookmarks, projects } from '../db/schema';
import { DbUser } from '../middleware/auth';
import { notificationService } from './NotificationService';
import { censorBadWords } from '../utils/contentModeration';

export interface CommentNode {
  id: string;
  projectId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorEmail?: string;
  authorRole?: string;
  content: string;
  score: number;
  upvotedBy: string[];
  downvotedBy: string[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

export class CommunityService {
  /**
   * Get like stats for a project.
   */
  async getLikes(projectId: string, userId?: string) {
    const allLikes = await db
      .select()
      .from(projectLikes)
      .where(eq(projectLikes.projectId, projectId));

    const isLiked = userId ? allLikes.some((l) => l.userId === String(userId)) : false;
    return {
      count: allLikes.length,
      isLiked,
    };
  }

  /**
   * Toggle like on a project.
   */
  async toggleLike(projectId: string, user: DbUser) {
    const userIdStr = String(user.id);
    const existing = await db
      .select()
      .from(projectLikes)
      .where(and(eq(projectLikes.projectId, projectId), eq(projectLikes.userId, userIdStr)))
      .limit(1);

    if (existing.length > 0) {
      // Remove like
      await db
        .delete(projectLikes)
        .where(and(eq(projectLikes.projectId, projectId), eq(projectLikes.userId, userIdStr)));
      
      // Update like_count in projects table
      await db
        .update(projects)
        .set({ likeCount: sql`max(0, ${projects.likeCount} - 1)` })
        .where(eq(projects.id, projectId));

      const updated = await this.getLikes(projectId, userIdStr);
      return { isLiked: false, count: updated.count };
    }

    // Add like
    await db.insert(projectLikes).values({
      projectId,
      userId: userIdStr,
      userEmail: user.email,
    });

    await db
      .update(projects)
      .set({ likeCount: sql`${projects.likeCount} + 1` })
      .where(eq(projects.id, projectId));

    const updated = await this.getLikes(projectId, userIdStr);

    notificationService.notifyProjectLike(projectId, user).catch((likeErr) => {
      console.warn('Like notification notice:', likeErr);
    });

    return { isLiked: true, count: updated.count };
  }

  /**
   * Get all bookmarked project IDs for a user.
   */
  async getBookmarks(userId: string, supabaseUid?: string): Promise<string[]> {
    const conditions = [eq(projectBookmarks.userId, String(userId))];
    if (supabaseUid && supabaseUid.trim()) {
      conditions.push(eq(projectBookmarks.userId, supabaseUid.trim()));
    }
    const rows = await db
      .select({ projectId: projectBookmarks.projectId })
      .from(projectBookmarks)
      .where(or(...conditions));

    return rows.map((r) => r.projectId);
  }

  /**
   * Toggle bookmark on a project.
   */
  async toggleBookmark(projectId: string, user: DbUser) {
    const userIdStr = String(user.id);
    const conditions = [eq(projectBookmarks.userId, userIdStr)];
    if (user.supabaseUid) {
      conditions.push(eq(projectBookmarks.userId, user.supabaseUid));
    }

    const existing = await db
      .select()
      .from(projectBookmarks)
      .where(and(eq(projectBookmarks.projectId, projectId), or(...conditions)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(projectBookmarks)
        .where(and(eq(projectBookmarks.projectId, projectId), or(...conditions)));
      return { isBookmarked: false, projectId };
    }

    await db.insert(projectBookmarks).values({
      projectId,
      userId: userIdStr,
    });

    return { isBookmarked: true, projectId };
  }

  /**
   * Get all comments for a project.
   */
  async getComments(projectId: string): Promise<CommentNode[]> {
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.projectId, projectId))
      .orderBy(asc(comments.createdAt));

    return rows.map((r) => {
      let upvotedBy: string[] = [];
      try {
        upvotedBy = r.upvotedBy ? JSON.parse(r.upvotedBy) : [];
      } catch {
        upvotedBy = [];
      }

      let downvotedBy: string[] = [];
      try {
        downvotedBy = r.downvotedBy ? JSON.parse(r.downvotedBy) : [];
      } catch {
        downvotedBy = [];
      }

      return {
        id: r.id,
        projectId: r.projectId,
        parentId: r.parentId,
        authorId: r.authorId,
        authorName: r.authorName,
        authorAvatar: r.authorAvatar || undefined,
        authorEmail: r.authorEmail || undefined,
        authorRole: r.authorRole || 'user',
        content: r.content,
        score: Number(r.score) || 0,
        upvotedBy,
        downvotedBy,
        isDeleted: Boolean(r.isDeleted),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || undefined,
      };
    });
  }

  /**
   * Add a new comment or reply.
   */
  async addComment(
    projectId: string,
    payload: { content: string; parentId?: string | null },
    user: DbUser
  ): Promise<CommentNode> {
    const id = `c_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();
    const rawContent = (payload.content || '').trim();
    if (!rawContent) {
      throw new Error('Comment content cannot be empty');
    }
    const cleanContent = censorBadWords(rawContent);
    const cleanAuthor = censorBadWords(user.name || 'Maker');

    await db.insert(comments).values({
      id,
      projectId,
      parentId: payload.parentId || null,
      authorId: String(user.id),
      authorName: cleanAuthor,
      authorAvatar: user.avatarUrl || null,
      authorEmail: user.email,
      authorRole: user.role || 'user',
      content: cleanContent,
      score: 1,
      upvotedBy: JSON.stringify([String(user.id)]),
      downvotedBy: JSON.stringify([]),
      isDeleted: false,
      createdAt: nowIso,
    });

    if (payload.parentId) {
      db.query.comments.findFirst({ where: eq(comments.id, payload.parentId) })
        .then((parent) => {
          if (parent) {
            notificationService.notifyCommentReply(projectId, parent, { id, content: cleanContent }, user).catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      notificationService.notifyComment(projectId, { id, content: cleanContent }, user).catch(() => {});
    }

    return {
      id,
      projectId,
      parentId: payload.parentId || null,
      authorId: String(user.id),
      authorName: user.name || 'Maker',
      authorAvatar: user.avatarUrl || undefined,
      authorEmail: user.email,
      authorRole: user.role || 'user',
      content: cleanContent,
      score: 1,
      upvotedBy: [String(user.id)],
      downvotedBy: [],
      isDeleted: false,
      createdAt: nowIso,
    };
  }

  /**
   * Vote on a comment.
   */
  async voteComment(commentId: string, voteType: 'up' | 'down' | 'none', user: DbUser) {
    const userIdStr = String(user.id);
    const existing = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
    });

    if (!existing) {
      throw new Error('Comment not found');
    }

    let upvotedBy: string[] = [];
    try {
      upvotedBy = existing.upvotedBy ? JSON.parse(existing.upvotedBy) : [];
    } catch {
      upvotedBy = [];
    }

    let downvotedBy: string[] = [];
    try {
      downvotedBy = existing.downvotedBy ? JSON.parse(existing.downvotedBy) : [];
    } catch {
      downvotedBy = [];
    }

    upvotedBy = upvotedBy.filter((id) => id !== userIdStr);
    downvotedBy = downvotedBy.filter((id) => id !== userIdStr);

    if (voteType === 'up') {
      upvotedBy.push(userIdStr);
    } else if (voteType === 'down') {
      downvotedBy.push(userIdStr);
    }

    const newScore = upvotedBy.length - downvotedBy.length;

    await db
      .update(comments)
      .set({
        upvotedBy: JSON.stringify(upvotedBy),
        downvotedBy: JSON.stringify(downvotedBy),
        score: newScore,
      })
      .where(eq(comments.id, commentId));

    return {
      id: commentId,
      score: newScore,
      upvotedBy,
      downvotedBy,
    };
  }

  /**
   * Delete a comment.
   */
  async deleteComment(commentId: string, user: DbUser) {
    const existing = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
    });

    if (!existing) {
      throw new Error('Comment not found');
    }

    const isOwner = existing.authorId === String(user.id);
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new Error('You do not have permission to delete this comment');
    }

    // Check if it has active child replies
    const children = await db
      .select()
      .from(comments)
      .where(eq(comments.parentId, commentId));

    if (children.length > 0) {
      // Soft-delete to preserve reply thread hierarchy
      await db
        .update(comments)
        .set({
          isDeleted: true,
          content: '[deleted]',
        })
        .where(eq(comments.id, commentId));
    } else {
      await db.delete(comments).where(eq(comments.id, commentId));
    }

    return { success: true, id: commentId };
  }
}

export const communityService = new CommunityService();
