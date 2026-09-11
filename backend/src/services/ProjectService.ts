import { eq, desc, and, like, or } from 'drizzle-orm';
import { db } from '../config/database';
import { projects, flashLogs } from '../db/schema';
import { DbUser } from '../middleware/auth';
import { notificationService } from './NotificationService';

export interface ProjectFilter {
  type?: string;
  difficulty?: number;
  isFeatured?: boolean;
  status?: string;
  visibility?: string;
  authorId?: string;
  search?: string;
  tag?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export function parseProjectRow(row: any) {
  if (!row) return null;
  let parsedTags: string[] = [];
  try {
    if (typeof row.tags === 'string' && row.tags.trim()) {
      parsedTags = JSON.parse(row.tags);
    } else if (Array.isArray(row.tags)) {
      parsedTags = row.tags;
    }
  } catch {
    parsedTags = [];
  }

  let parsedFirmwares: any[] = [];
  try {
    if (typeof row.firmwares === 'string' && row.firmwares.trim()) {
      parsedFirmwares = JSON.parse(row.firmwares);
    } else if (Array.isArray(row.firmwares)) {
      parsedFirmwares = row.firmwares;
    }
  } catch {
    parsedFirmwares = [];
  }

  return {
    ...row,
    id: row.id,
    slug: row.slug || row.id,
    publishDate: row.publishDate || '',
    type: row.type || 'Project',
    level: Number(row.level) || 1,
    author: row.author || 'Maker',
    authorAvatar: row.authorAvatar || '',
    authorRole: row.authorRole || 'author',
    authorId: row.authorId || '',
    authorEmail: row.authorEmail || '',
    status: row.status || 'published',
    visibility: row.visibility || 'public',
    flashCount: Number(row.flashCount) || 0,
    likeCount: Number(row.likeCount) || 0,
    viewCount: Number(row.viewCount) || 0,
    featured: Boolean(row.featured),
    isFeatured: Boolean(row.featured),
    description: row.description || '',
    coverImage: row.coverImage || '',
    docLink: row.docLink || '',
    githubLink: row.githubLink || '',
    videoLink: row.videoLink || '',
    projectMdFile: row.projectMdFile || row.project_md_file || null,
    markdownContent: row.markdownContent || '',
    compatibleBoard: row.compatibleBoard || 'UNIHIKER K10',
    license: row.license || 'MIT',
    tags: parsedTags,
    firmwares: parsedFirmwares,
  };
}

export class ProjectService {
  async getProjects(
    filter: ProjectFilter = {},
    pagination: Pagination = { page: 1, pageSize: 50 },
    currentUser?: DbUser
  ) {
    const conditions = [];

    if (filter.type) {
      conditions.push(eq(projects.type, filter.type));
    }
    if (filter.difficulty) {
      conditions.push(eq(projects.level, filter.difficulty));
    }
    if (filter.isFeatured !== undefined) {
      conditions.push(eq(projects.featured, filter.isFeatured));
    }
    if (filter.search) {
      const q = `%${filter.search}%`;
      conditions.push(or(like(projects.title, q), like(projects.description, q), like(projects.tags, q)));
    }
    if (filter.tag) {
      conditions.push(like(projects.tags, `%"${filter.tag}"%`));
    }
    if (filter.authorId) {
      conditions.push(eq(projects.authorId, filter.authorId));
    }

    const isAdmin = currentUser?.role === 'admin';
    const ownerConditions = [];
    if (currentUser) {
      if (currentUser.id) ownerConditions.push(eq(projects.authorId, String(currentUser.id)));
      if (currentUser.supabaseUid) ownerConditions.push(eq(projects.authorId, currentUser.supabaseUid));
      if (currentUser.email) {
        ownerConditions.push(eq(projects.authorEmail, currentUser.email.toLowerCase()));
        ownerConditions.push(like(projects.authorEmail, `%${currentUser.email.toLowerCase()}%`));
      }
    }
    const isOwnerCondition = ownerConditions.length > 0 ? or(...ownerConditions) : undefined;

    if (isAdmin) {
      // Admin sees everything or requested filters
      if (filter.status) {
        conditions.push(eq(projects.status, filter.status as any));
      }
      if (filter.visibility) {
        conditions.push(eq(projects.visibility, filter.visibility as any));
      }
    } else if (currentUser && isOwnerCondition) {
      // Authenticated author/user
      if (filter.status) {
        if (filter.status === 'published') {
          conditions.push(eq(projects.status, 'published'));
          if (filter.visibility) {
            conditions.push(eq(projects.visibility, filter.visibility as any));
          } else {
            conditions.push(eq(projects.visibility, 'public'));
          }
        } else {
          // Author only sees their own items for draft / pending_approval / rejected
          conditions.push(and(eq(projects.status, filter.status as any), isOwnerCondition));
        }
      } else {
        // No status filter: return public published projects PLUS all projects owned by the user
        conditions.push(
          or(
            and(eq(projects.status, 'published'), eq(projects.visibility, 'public')),
            isOwnerCondition
          )
        );
      }
    } else {
      // Guest: only published and public
      conditions.push(eq(projects.status, 'published'));
      conditions.push(eq(projects.visibility, 'public'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (pagination.page - 1) * pagination.pageSize;

    const rawData = await db.query.projects.findMany({
      where: whereClause,
      limit: pagination.pageSize,
      offset,
      orderBy: [desc(projects.createdAt)],
    });

    const all = await db.select().from(projects).where(whereClause);
    const total = all.length;

    const data = rawData.map(parseProjectRow);

    return { data, total };
  }

  async getFeaturedProjects(limit = 6) {
    const rawData = await db.query.projects.findMany({
      where: and(eq(projects.featured, true), eq(projects.status, 'published')),
      limit,
      orderBy: [desc(projects.likeCount), desc(projects.flashCount)],
    });
    return rawData.map(parseProjectRow);
  }

  async getProjectsByAuthor(authorIdentifier: string | number, userEmail?: string, supabaseUid?: string) {
    const authorConditions = [
      eq(projects.authorId, String(authorIdentifier)),
    ];
    if (userEmail && userEmail.trim()) {
      authorConditions.push(eq(projects.authorEmail, userEmail.trim().toLowerCase()));
      authorConditions.push(like(projects.authorEmail, `%${userEmail.trim().toLowerCase()}%`));
    }
    if (supabaseUid && supabaseUid.trim()) {
      authorConditions.push(eq(projects.authorId, supabaseUid.trim()));
    }
    const query = String(authorIdentifier).toLowerCase();
    if (query && query !== 'undefined' && query !== 'null') {
      authorConditions.push(like(projects.author, `%${query}%`));
    }

    const rawData = await db.query.projects.findMany({
      where: or(...authorConditions),
      orderBy: [desc(projects.createdAt)],
    });
    return rawData.map(parseProjectRow);
  }

  async getProjectById(idOrSlug: string) {
    if (!idOrSlug) return null;
    const clean = idOrSlug.trim().toLowerCase();
    const raw = await db.query.projects.findFirst({
      where: or(eq(projects.id, clean), eq(projects.slug, clean)),
    });

    return parseProjectRow(raw);
  }

  async saveProject(payload: any, user?: DbUser) {
    const now = Math.floor(Date.now() / 1000);
    const cleanId = (payload.id || payload.slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-');

    if (!cleanId) {
      throw new Error('Project ID / slug is required');
    }

    const existing = await db.query.projects.findFirst({
      where: or(eq(projects.id, cleanId), eq(projects.slug, cleanId)),
    });

    const serializedTags = payload.tags !== undefined
      ? (Array.isArray(payload.tags) ? JSON.stringify(payload.tags) : typeof payload.tags === 'string' ? payload.tags : '[]')
      : (existing?.tags || '[]');

    const serializedFirmwares = payload.firmwares !== undefined
      ? (Array.isArray(payload.firmwares) ? JSON.stringify(payload.firmwares) : typeof payload.firmwares === 'string' ? payload.firmwares : '[]')
      : (existing?.firmwares || '[]');

    const authorName = payload.author || existing?.author || user?.name || 'Maker';
    const authorAvatar = payload.authorAvatar !== undefined ? payload.authorAvatar : (existing?.authorAvatar || user?.avatarUrl || '');
    const authorRole = payload.authorRole !== undefined ? payload.authorRole : (existing?.authorRole || user?.role || 'author');
    const authorId = payload.authorId !== undefined ? payload.authorId : (existing?.authorId || (user ? String(user.id) : ''));
    const authorEmail = payload.authorEmail !== undefined ? payload.authorEmail : (existing?.authorEmail || user?.email || '');

    const isFeaturedVal = Boolean(payload.featured ?? payload.isFeatured ?? existing?.featured ?? false);

    if (existing) {
      // Permission check if user provided
      if (user && user.role !== 'admin') {
        const isOwner =
          (existing.authorId && String(existing.authorId) === String(user.id)) ||
          (existing.authorEmail && existing.authorEmail.toLowerCase() === user.email.toLowerCase());
        if (!isOwner) {
          throw new Error('You do not have permission to edit this project');
        }
      }

      await db
        .update(projects)
        .set({
          title: payload.title !== undefined ? payload.title : existing.title,
          publishDate: payload.publishDate || existing.publishDate,
          type: payload.type || existing.type,
          level: payload.level !== undefined ? Number(payload.level) : existing.level,
          author: authorName,
          authorAvatar,
          authorRole,
          authorId: authorId || existing.authorId,
          authorEmail: authorEmail || existing.authorEmail,
          status: payload.status || existing.status,
          visibility: payload.visibility || existing.visibility,
          featured: isFeaturedVal,
          description: payload.description !== undefined ? payload.description : existing.description,
          coverImage: payload.coverImage !== undefined ? payload.coverImage : existing.coverImage,
          docLink: payload.docLink !== undefined ? payload.docLink : existing.docLink,
          githubLink: payload.githubLink !== undefined ? payload.githubLink : existing.githubLink,
          videoLink: payload.videoLink !== undefined ? payload.videoLink : existing.videoLink,
          projectMdFile: payload.projectMdFile !== undefined ? payload.projectMdFile : (existing.projectMdFile || null),
          markdownContent: payload.markdownContent !== undefined ? payload.markdownContent : existing.markdownContent,
          compatibleBoard: payload.compatibleBoard || existing.compatibleBoard,
          license: payload.license || existing.license,
          tags: serializedTags,
          firmwares: serializedFirmwares,
          updatedAt: now,
        })
        .where(eq(projects.id, existing.id));

      if (existing.status !== 'published' && payload.status === 'published') {
        notificationService.notifyProjectApproval(existing.id).catch((notifErr) => {
          console.warn('Project approval notification notice:', notifErr);
        });
      }

      return this.getProjectById(existing.id);
    }

    // Insert new project
    await db.insert(projects).values({
      id: cleanId,
      slug: cleanId,
      title: payload.title || 'Untitled Project',
      publishDate: payload.publishDate || '',
      type: payload.type || 'Project',
      level: Number(payload.level) || 1,
      author: authorName,
      authorAvatar,
      authorRole,
      authorId,
      authorEmail,
      status: payload.status || 'published',
      visibility: payload.visibility || 'public',
      flashCount: Number(payload.flashCount) || 0,
      likeCount: Number(payload.likeCount) || 0,
      viewCount: 0,
      featured: isFeaturedVal,
      description: payload.description || '',
      coverImage: payload.coverImage || '',
      docLink: payload.docLink || null,
      githubLink: payload.githubLink || null,
      videoLink: payload.videoLink || null,
      projectMdFile: payload.projectMdFile || null,
      markdownContent: payload.markdownContent || '',
      compatibleBoard: payload.compatibleBoard || 'UNIHIKER K10',
      license: payload.license || 'MIT',
      tags: serializedTags,
      firmwares: serializedFirmwares,
      createdAt: now,
      updatedAt: now,
    });

    return this.getProjectById(cleanId);
  }

  async deleteProject(id: string, user?: DbUser) {
    const existing = await this.getProjectById(id);
    if (!existing) {
      throw new Error('Project not found');
    }

    if (user && user.role !== 'admin') {
      const isOwner =
        (existing.authorId && String(existing.authorId) === String(user.id)) ||
        (existing.authorEmail && existing.authorEmail.toLowerCase() === user.email.toLowerCase());
      if (!isOwner) {
        throw new Error('You do not have permission to delete this project');
      }
    }

    await db.delete(projects).where(eq(projects.id, existing.id));
    return { success: true, id: existing.id };
  }

  async incrementFlashCount(id: string, userId?: string) {
    const existing = await this.getProjectById(id);
    if (existing) {
      const newCount = (existing.flashCount || 0) + 1;
      await db.update(projects).set({ flashCount: newCount }).where(eq(projects.id, existing.id));

      try {
        await db.insert(flashLogs).values({
          projectId: existing.id,
          userId: userId ? String(userId) : null,
        });
      } catch (logErr) {
        console.warn('Could not insert flash log into DB:', logErr);
      }

      notificationService.checkFlashMilestone(existing.id, newCount).catch((mErr) => {
        console.warn('Flash milestone notification notice:', mErr);
      });

      return newCount;
    }
    return 0;
  }

  async toggleFeatured(id: string) {
    const existing = await this.getProjectById(id);
    if (!existing) throw new Error('Project not found');

    const nextFeatured = !existing.featured;
    await db.update(projects).set({ featured: nextFeatured }).where(eq(projects.id, existing.id));
    return nextFeatured;
  }

  async incrementViewCount(idOrSlug: string) {
    const existing = await this.getProjectById(idOrSlug);
    if (existing) {
      await db
        .update(projects)
        .set({ viewCount: (existing.viewCount || 0) + 1 })
        .where(eq(projects.id, existing.id));
    }
  }
}

export const projectService = new ProjectService();
