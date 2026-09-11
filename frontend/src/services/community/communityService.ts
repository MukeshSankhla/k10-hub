// communityService.ts
// Handles Likes, Reddit-style Nested Comments, and Bookmarks for UNIHIKER K10 Projects & Tutorials.
// Integrated with backend database API with local resilience caching.

import { ProjectDetail } from '../../config/projectsData';
import { getAllProjects } from '../projects/projectStorageService';
import { api } from '../api';

export interface ProjectComment {
  id: string;
  projectId: string;
  parentId: string | null; // null for top-level, or parent comment id for nested replies
  authorName: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorRole?: string;
  authorId: string; // Strictly required
  content: string;
  createdAt: string; // ISO string
  score: number;
  upvotedBy: string[];
  downvotedBy: string[];
  isDeleted?: boolean;
}

const LIKES_KEY = 'k10_community_likes_v2';
const BOOKMARKS_KEY = 'k10_community_bookmarks_v2';
const COMMENTS_KEY = 'k10_community_comments_v2';
const COMMUNITY_EVENT = 'k10_community_updated';

function dispatchCommunityUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMMUNITY_EVENT));
  }
}

export function subscribeCommunity(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(COMMUNITY_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(COMMUNITY_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

// ─── LIKES ─────────────────────────────────────────────────────────────────────

function getLikesMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LIKES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveLikesMap(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(LIKES_KEY, JSON.stringify(map));
    dispatchCommunityUpdate();
  } catch (e) {
    console.error('Failed to save likes', e);
  }
}

export function getProjectLikeCount(projectId: string, fallbackBase = 0): number {
  if (!projectId) return fallbackBase;
  const map = getLikesMap();
  const likedUsers = map[projectId.toLowerCase()] || [];
  return Math.max(likedUsers.length, fallbackBase);
}

export function isProjectLiked(projectId: string, userId?: string): boolean {
  if (!projectId || !userId) return false;
  const uid = String(userId).trim().toLowerCase();
  const map = getLikesMap();
  const list = map[projectId.toLowerCase()] || [];
  return list.some((id) => id.toLowerCase() === uid);
}

export async function fetchProjectLikesFromDb(projectId: string, userId?: string): Promise<{ count: number; isLiked: boolean }> {
  if (!projectId) return { count: 0, isLiked: false };
  try {
    const res = await api.community.getLikes(projectId);
    if (res) {
      const map = getLikesMap();
      const key = projectId.toLowerCase();
      if (res.isLiked && userId) {
        const list = map[key] || [];
        if (!list.includes(String(userId).toLowerCase())) {
          map[key] = [...list, String(userId).toLowerCase()];
          saveLikesMap(map);
        }
      }
      return { count: res.count, isLiked: res.isLiked };
    }
  } catch (err) {
    // Fail gracefully to cache
  }
  return {
    count: getProjectLikeCount(projectId),
    isLiked: isProjectLiked(projectId, userId),
  };
}

export function toggleProjectLike(projectId: string, userId?: string, fallbackBase = 0): { liked: boolean; count: number } {
  if (!userId) {
    throw new Error('Please sign in to like projects and tutorials.');
  }
  if (!projectId) return { liked: false, count: 0 };
  const uid = String(userId).trim().toLowerCase();
  const map = getLikesMap();
  const key = projectId.toLowerCase();
  let list = map[key] || [];

  let liked = false;
  if (list.some((id) => id.toLowerCase() === uid)) {
    list = list.filter((id) => id.toLowerCase() !== uid);
    liked = false;
  } else {
    list = [...list, uid];
    liked = true;
  }

  map[key] = list;
  saveLikesMap(map);
  const count = Math.max(list.length, fallbackBase);

  // Sync with DB
  api.community.toggleLike(projectId).then((res) => {
    if (res && typeof res.count === 'number') {
      // Sync confirmed count
    }
  }).catch((err) => {
    console.warn('Backend like sync notice:', err);
  });

  return { liked, count };
}

// ─── BOOKMARKS ─────────────────────────────────────────────────────────────────

function getBookmarksMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveBookmarksMap(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(map));
    dispatchCommunityUpdate();
  } catch (e) {
    console.error('Failed to save bookmarks', e);
  }
}

export function isProjectBookmarked(projectId: string, userId?: string, altUserId?: string): boolean {
  if (!projectId || (!userId && !altUserId)) return false;
  const map = getBookmarksMap();
  const cleanId = projectId.toLowerCase();
  const keys = [
    userId ? String(userId).trim().toLowerCase() : null,
    altUserId ? String(altUserId).trim().toLowerCase() : null,
  ].filter(Boolean) as string[];

  for (const k of keys) {
    const list = map[k] || [];
    if (list.some((id) => id.toLowerCase() === cleanId)) {
      return true;
    }
  }
  return false;
}

export async function fetchUserBookmarksFromDb(userId?: string, altUserId?: string): Promise<string[]> {
  if (!userId && !altUserId) return [];
  try {
    const res = await api.community.getBookmarks();
    if (res && Array.isArray(res.bookmarks)) {
      const cleanBookmarks = res.bookmarks.map((b: string) => b.toLowerCase());
      const map = getBookmarksMap();
      if (userId) {
        map[String(userId).trim().toLowerCase()] = cleanBookmarks;
      }
      if (altUserId) {
        map[String(altUserId).trim().toLowerCase()] = cleanBookmarks;
      }
      saveBookmarksMap(map);
      return res.bookmarks;
    }
  } catch (err) {
    // Fail gracefully to cache
  }
  return getUserBookmarkedProjectIds(userId, altUserId);
}

export function toggleProjectBookmark(projectId: string, userId?: string, altUserId?: string): boolean {
  if (!userId && !altUserId) {
    throw new Error('Please sign in to bookmark projects and tutorials.');
  }
  if (!projectId) return false;
  const map = getBookmarksMap();
  const cleanId = projectId.toLowerCase();
  const keys = [
    userId ? String(userId).trim().toLowerCase() : null,
    altUserId ? String(altUserId).trim().toLowerCase() : null,
  ].filter(Boolean) as string[];

  let isCurrentlyBookmarked = false;
  for (const k of keys) {
    if ((map[k] || []).some((id) => id.toLowerCase() === cleanId)) {
      isCurrentlyBookmarked = true;
      break;
    }
  }

  const willBeBookmarked = !isCurrentlyBookmarked;

  for (const k of keys) {
    let userBookmarks = map[k] || [];
    if (willBeBookmarked) {
      if (!userBookmarks.some((id) => id.toLowerCase() === cleanId)) {
        userBookmarks = [cleanId, ...userBookmarks];
      }
    } else {
      userBookmarks = userBookmarks.filter((id) => id.toLowerCase() !== cleanId);
    }
    map[k] = userBookmarks;
  }

  saveBookmarksMap(map);

  // Sync with DB
  api.community.toggleBookmark(projectId).catch((err) => {
    console.warn('Backend bookmark sync notice:', err);
  });

  return willBeBookmarked;
}

export function getUserBookmarkedProjectIds(userId?: string, altUserId?: string): string[] {
  if (!userId && !altUserId) return [];
  const map = getBookmarksMap();
  const ids = new Set<string>();

  if (userId) {
    const uid = String(userId).trim().toLowerCase();
    const list = map[uid] || [];
    list.forEach((id) => ids.add(id.toLowerCase()));
  }
  if (altUserId) {
    const altUid = String(altUserId).trim().toLowerCase();
    const list = map[altUid] || [];
    list.forEach((id) => ids.add(id.toLowerCase()));
  }

  return Array.from(ids);
}

export function getUserBookmarkedProjects(userId?: string, altUserId?: string): ProjectDetail[] {
  const ids = getUserBookmarkedProjectIds(userId, altUserId);
  if (!ids.length) return [];
  const all = getAllProjects();
  const mapById = new Map<string, ProjectDetail>();
  for (const p of all) {
    mapById.set(p.id.toLowerCase(), p);
    if ((p as any).slug) {
      mapById.set(String((p as any).slug).toLowerCase(), p);
    }
  }
  const result: ProjectDetail[] = [];
  for (const id of ids) {
    const found = mapById.get(id.toLowerCase());
    if (found) {
      result.push(found);
    }
  }
  return result;
}

// ─── REDDIT-STYLE NESTED COMMENTS ──────────────────────────────────────────────

function getAllStoredComments(): ProjectComment[] {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveAllComments(comments: ProjectComment[]): void {
  try {
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
    dispatchCommunityUpdate();
  } catch (e) {
    console.error('Failed to save comments', e);
  }
}

export function getProjectComments(projectId: string): ProjectComment[] {
  if (!projectId) return [];
  const all = getAllStoredComments();
  const cleanId = projectId.toLowerCase();
  const cached = all.filter((c) => c.projectId.toLowerCase() === cleanId);

  // Asynchronously trigger refresh from backend DB
  refreshCommentsFromDb(projectId).catch(() => {});
  return cached;
}

export async function refreshCommentsFromDb(projectId: string): Promise<ProjectComment[]> {
  if (!projectId) return [];
  try {
    const res = await api.community.getComments(projectId);
    if (res && Array.isArray(res.comments)) {
      const dbComments: ProjectComment[] = res.comments.map((c: any) => ({
        id: c.id,
        projectId: c.projectId.toLowerCase(),
        parentId: c.parentId || null,
        authorName: c.authorName || 'Maker',
        authorEmail: c.authorEmail,
        authorAvatar: c.authorAvatar,
        authorRole: c.authorRole || 'user',
        authorId: String(c.authorId),
        content: c.content,
        createdAt: c.createdAt,
        score: Number(c.score) || 0,
        upvotedBy: Array.isArray(c.upvotedBy) ? c.upvotedBy : [],
        downvotedBy: Array.isArray(c.downvotedBy) ? c.downvotedBy : [],
        isDeleted: Boolean(c.isDeleted),
      }));

      const all = getAllStoredComments();
      const cleanId = projectId.toLowerCase();
      const otherComments = all.filter((c) => c.projectId.toLowerCase() !== cleanId);
      const updated = [...dbComments, ...otherComments];
      saveAllComments(updated);
      return dbComments;
    }
  } catch (err) {
    // Keep local cache on network error
  }
  const all = getAllStoredComments();
  return all.filter((c) => c.projectId.toLowerCase() === projectId.toLowerCase());
}

export function getProjectCommentCount(projectId: string): number {
  if (!projectId) return 0;
  const list = getAllStoredComments().filter((c) => c.projectId.toLowerCase() === projectId.toLowerCase());
  return list.filter((c) => !c.isDeleted).length;
}

export interface CommentAuthor {
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
  id: string; // Strictly required
}

export function addComment(
  projectId: string,
  content: string,
  parentId: string | null = null,
  author?: CommentAuthor
): ProjectComment {
  if (!author || !author.id) {
    throw new Error('Please sign in to post comments or replies.');
  }

  const cleanContent = content.trim();
  if (!cleanContent) {
    throw new Error('Comment content cannot be empty.');
  }

  const authorIdStr = String(author.id).trim();
  const all = getAllStoredComments();
  const newComment: ProjectComment = {
    id: 'cmt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
    projectId: projectId.toLowerCase(),
    parentId: parentId || null,
    authorName: author.name || 'Maker',
    authorEmail: author.email,
    authorAvatar: author.avatar,
    authorRole: author.role || 'User',
    authorId: authorIdStr,
    content: cleanContent,
    createdAt: new Date().toISOString(),
    score: 1, // Reddit-style start with 1 upvote from author
    upvotedBy: [authorIdStr],
    downvotedBy: [],
    isDeleted: false,
  };

  all.unshift(newComment);
  saveAllComments(all);

  // Sync to database
  api.community.addComment(projectId, { content: cleanContent, parentId }).then((res) => {
    if (res && res.comment) {
      // Re-sync with backend ID
      refreshCommentsFromDb(projectId).catch(() => {});
    }
  }).catch((err) => {
    console.warn('Backend comment post notice:', err);
  });

  return newComment;
}

export function voteComment(
  commentId: string,
  type: 'up' | 'down',
  userId?: string
): ProjectComment | null {
  if (!userId) {
    throw new Error('Please sign in to vote on discussion comments.');
  }
  const uid = String(userId).trim().toLowerCase();
  const all = getAllStoredComments();
  const idx = all.findIndex((c) => c.id === commentId);
  if (idx < 0) return null;

  const comment = { ...all[idx] };
  const hasUpvoted = comment.upvotedBy.some((id) => id.toLowerCase() === uid);
  const hasDownvoted = comment.downvotedBy.some((id) => id.toLowerCase() === uid);

  let voteType: 'up' | 'down' | 'none' = 'none';

  if (type === 'up') {
    if (hasUpvoted) {
      comment.upvotedBy = comment.upvotedBy.filter((id) => id.toLowerCase() !== uid);
      voteType = 'none';
    } else {
      comment.upvotedBy = [...comment.upvotedBy, uid];
      comment.downvotedBy = comment.downvotedBy.filter((id) => id.toLowerCase() !== uid);
      voteType = 'up';
    }
  } else {
    if (hasDownvoted) {
      comment.downvotedBy = comment.downvotedBy.filter((id) => id.toLowerCase() !== uid);
      voteType = 'none';
    } else {
      comment.downvotedBy = [...comment.downvotedBy, uid];
      comment.upvotedBy = comment.upvotedBy.filter((id) => id.toLowerCase() !== uid);
      voteType = 'down';
    }
  }

  comment.score = comment.upvotedBy.length - comment.downvotedBy.length;
  all[idx] = comment;
  saveAllComments(all);

  // Sync with DB
  api.community.voteComment(commentId, voteType).catch((err) => {
    console.warn('Backend comment vote notice:', err);
  });

  return comment;
}

export function deleteComment(commentId: string, _userIdentifier?: string): boolean {
  const all = getAllStoredComments();
  const idx = all.findIndex((c) => c.id === commentId);
  if (idx < 0) return false;

  const comment = all[idx];
  const hasReplies = all.some((c) => c.parentId === commentId);

  if (hasReplies) {
    all[idx] = {
      ...comment,
      isDeleted: true,
      content: '[This comment has been removed by author]',
    };
  } else {
    all.splice(idx, 1);
  }

  saveAllComments(all);

  // Sync with DB
  api.community.deleteComment(commentId).catch((err) => {
    console.warn('Backend comment delete notice:', err);
  });

  return true;
}

/**
 * Builds nested comment tree node structure for recursive rendering
 */
export interface CommentTreeNode {
  comment: ProjectComment;
  children: CommentTreeNode[];
}

export function buildCommentTree(comments: ProjectComment[]): CommentTreeNode[] {
  const map = new Map<string, CommentTreeNode>();
  const roots: CommentTreeNode[] = [];

  // Initialize nodes
  for (const comment of comments) {
    map.set(comment.id, { comment, children: [] });
  }

  // Build tree
  for (const comment of comments) {
    const node = map.get(comment.id)!;
    if (comment.parentId && map.has(comment.parentId)) {
      map.get(comment.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

