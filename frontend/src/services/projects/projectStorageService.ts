import { ProjectDetail } from '../../config/projectsData';
import { api } from '../api';
import { isKnownAdmin } from '../../components/common/UserBadge';
import { convertGithubBlobToRaw } from '../../utils/githubUrl';
import { censorBadWords } from '../../utils/contentModeration';

const STORAGE_KEY = 'k10_projects_store_v3';
const UPDATE_EVENT = 'k10_projects_updated';

// In-memory cache for instant synchronous access across React components
let memoryProjectsCache: ProjectDetail[] = [];
let hasFetchedFromBackend = false;
let isFetchingBackend = false;

// Initialize cache from localStorage if available, then immediately sync from backend API
function initializeMemoryCache(): ProjectDetail[] {
  if (memoryProjectsCache.length > 0) return memoryProjectsCache;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryProjectsCache = parsed;
        }
      }
    }
  } catch (e) {
    // Ignore initial parse errors
  }
  return memoryProjectsCache;
}

// Initialize on module load
initializeMemoryCache();

/**
 * Fetches the latest projects directly from the backend database
 * and updates the cache and localStorage.
 */
export async function refreshProjectsFromBackend(retryCount = 0): Promise<ProjectDetail[]> {
  if (isFetchingBackend) return memoryProjectsCache;
  isFetchingBackend = true;
  try {
    const res = await api.projects.list({ pageSize: 100 });
    if (res && Array.isArray(res.data)) {
      const dbProjects: ProjectDetail[] = res.data.map((p: any) => ({
        id: p.id || p.slug,
        title: p.title || 'Untitled Project',
        publishDate: p.publishDate || '',
        type: p.type || 'Project',
        level: Number(p.level) || 1,
        author: p.author || 'Maker',
        authorAvatar: p.authorAvatar || '',
        authorRole: isKnownAdmin({ name: p.author, email: p.authorEmail, role: p.authorRole })
          ? 'admin'
          : (p.authorRole || 'author'),
        authorId: p.authorId || '',
        authorEmail: p.authorEmail || '',
        status: p.status || 'published',
        visibility: p.visibility || 'public',
        flashCount: Number(p.flashCount) || 0,
        featured: Boolean(p.featured ?? p.isFeatured),
        isFeatured: Boolean(p.featured ?? p.isFeatured),
        description: p.description || '',
        coverImage: p.coverImage || '/images/Place Holder.png',
        docLink: p.docLink || '',
        githubLink: p.githubLink || '',
        videoLink: p.videoLink || '',
        projectMdFile: p.projectMdFile || null,
        markdownContent: p.markdownContent || '',
        compatibleBoard: p.compatibleBoard || 'UNIHIKER K10',
        license: p.license || 'MIT',
        tags: Array.isArray(p.tags) ? p.tags : [],
        firmwares: Array.isArray(p.firmwares) ? p.firmwares : [],
        attachments: Array.isArray(p.attachments) ? p.attachments : [],
      }));

      // Merge with any locally stored unapproved projects (drafts or pending_approval)
      // so local or in-flight author submissions are not prematurely dropped
      const mergedMap = new Map<string, ProjectDetail>();
      for (const p of dbProjects) {
        mergedMap.set(p.id.toLowerCase(), p);
      }
      for (const localP of memoryProjectsCache) {
        if (!mergedMap.has(localP.id.toLowerCase()) && (localP.status === 'draft' || localP.status === 'pending_approval')) {
          mergedMap.set(localP.id.toLowerCase(), localP);
        }
      }
      const finalProjects = Array.from(mergedMap.values());

      memoryProjectsCache = finalProjects;
      hasFetchedFromBackend = true;

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalProjects));
        }
      } catch {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
      }
      return finalProjects;
    }
  } catch (err) {
    console.warn('Backend projects sync notice (using cached data):', err);
    // If backend was unreachable and cache is empty, retry shortly (e.g. dev server starting)
    if (retryCount < 3 && memoryProjectsCache.length === 0) {
      setTimeout(() => {
        refreshProjectsFromBackend(retryCount + 1).catch(() => {});
      }, 1500 * (retryCount + 1));
    }
  } finally {
    isFetchingBackend = false;
  }
  return memoryProjectsCache;
}

// Trigger background refresh on app load and window focus
if (typeof window !== 'undefined') {
  setTimeout(() => {
    refreshProjectsFromBackend().catch(() => {});
  }, 10);

  window.addEventListener('focus', () => {
    refreshProjectsFromBackend().catch(() => {});
  });
}

/**
 * Normalizes an array of projects, ensuring defaults and integrity.
 */
function getStoredProjects(): ProjectDetail[] {
  if (memoryProjectsCache.length === 0 && !hasFetchedFromBackend) {
    initializeMemoryCache();
  }
  return memoryProjectsCache;
}

/**
 * Manually clears all project and author storage from the browser.
 */
export function clearAllProjectStorage(): void {
  try {
    memoryProjectsCache = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('k10_projects_store_v2');
    localStorage.removeItem('k10_projects_store_v1');
    localStorage.removeItem('k10_projects_store');
    localStorage.removeItem('k10_authors_profile_cache');
    localStorage.removeItem('k10_flash_counts');
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  } catch (err) {
    console.warn('Failed to clear project storage:', err);
  }
}

/**
 * Checks whether the currently logged-in user is the author of the project.
 */
export function isProjectAuthor(
  project?: ProjectDetail | null,
  user?: any,
  profile?: any
): boolean {
  if (!project) return false;
  if (!user && !profile) return false;

  const userIds = [
    profile?.id !== undefined && profile?.id !== null ? String(profile.id).toLowerCase() : null,
    user?.id !== undefined && user?.id !== null ? String(user.id).toLowerCase() : null,
  ].filter(Boolean) as string[];

  const userEmails = [
    profile?.email,
    user?.email,
    user?.user_metadata?.email,
  ].filter(Boolean).map((e: string) => e.trim().toLowerCase());

  const userNames = [
    profile?.name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
    user?.email ? user.email.split('@')[0] : null,
  ].filter(Boolean).map((n: string) => n.trim().toLowerCase());

  const projectAuthorId = project.authorId ? String(project.authorId).toLowerCase() : '';
  const projectAuthorEmail = (project.authorEmail || '').trim().toLowerCase();
  const projectAuthorName = (project.author || '').trim().toLowerCase();

  // 1. Match by Author ID
  if (projectAuthorId && userIds.some((id) => id === projectAuthorId)) {
    return true;
  }

  // 2. Match by Email
  if (projectAuthorEmail && userEmails.some((email) => email === projectAuthorEmail)) {
    return true;
  }

  // 3. Match by Author Name or Email Prefix
  for (const name of userNames) {
    if (name && projectAuthorName) {
      if (name === projectAuthorName || projectAuthorName.includes(name) || name.includes(projectAuthorName)) {
        return true;
      }
    }
  }

  // 4. Default fallback: if project has no author identity assigned yet, current authenticated author owns it
  if (!projectAuthorId && !projectAuthorEmail && !projectAuthorName) {
    return true;
  }

  return false;
}

const AUTHORS_CACHE_KEY = 'k10_authors_profile_cache';

export interface CachedAuthorProfile {
  id?: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  email?: string;
  updatedAt?: number;
}

export function getKnownAuthorsCache(): Record<string, CachedAuthorProfile> {
  try {
    const raw = localStorage.getItem(AUTHORS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveKnownAuthor(author: CachedAuthorProfile): void {
  if (!author || (!author.id && !author.name && !author.email)) return;
  try {
    const cache = getKnownAuthorsCache();
    const entry: CachedAuthorProfile = {
      ...author,
      updatedAt: Date.now(),
    };
    if (author.id) cache[String(author.id).toLowerCase()] = entry;
    if (author.email) cache[author.email.toLowerCase()] = entry;
    if (author.name) cache[author.name.toLowerCase()] = entry;
    localStorage.setItem(AUTHORS_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('Failed to cache author profile:', err);
  }
}

export interface ResolvedAuthor {
  name: string;
  avatarUrl?: string;
  role?: string;
  authorId?: string;
  isCurrentUser: boolean;
}

/**
 * Dynamically resolves author information (name, avatar, role, and ID) for a project.
 * If the project belongs to the currently logged in user, it returns their live profile.
 * Otherwise, checks the cached author directory or falls back to project snapshot fields.
 */
export function resolveProjectAuthor(
  project?: ProjectDetail | null,
  currentUser?: any,
  currentProfile?: any
): ResolvedAuthor {
  if (!project) {
    return {
      name: 'Unknown Maker',
      avatarUrl: '',
      role: 'user',
      authorId: '',
      isCurrentUser: false,
    };
  }

  // 1. If currently logged in user is the author, ALWAYS return their live profile!
  if (currentUser || currentProfile) {
    if (isProjectAuthor(project, currentUser, currentProfile)) {
      const liveName =
        currentProfile?.name ||
        currentUser?.user_metadata?.name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.email?.split('@')[0] ||
        project.author ||
        'Maker';
      const liveAvatar =
        currentProfile?.avatarUrl ||
        currentUser?.user_metadata?.avatar_url ||
        project.authorAvatar ||
        '';
      const liveRole =
        currentProfile?.role ||
        project.authorRole ||
        'author';
      const liveId = String(currentProfile?.id || currentUser?.id || project.authorId || '');
      const isLiveAdmin = isKnownAdmin({
        name: liveName,
        email: currentProfile?.email || currentUser?.email || project.authorEmail,
        role: liveRole,
        id: liveId,
      });

      return {
        name: liveName,
        avatarUrl: liveAvatar,
        role: isLiveAdmin ? 'admin' : liveRole,
        authorId: liveId,
        isCurrentUser: true,
      };
    }
  }

  // 2. Check author cache by authorId, authorEmail, or authorName
  const cache = getKnownAuthorsCache();
  const idKey = project.authorId ? String(project.authorId).toLowerCase() : '';
  const emailKey = project.authorEmail ? project.authorEmail.toLowerCase() : '';
  const nameKey = project.author ? project.author.toLowerCase() : '';

  const cached =
    (idKey && cache[idKey]) ||
    (emailKey && cache[emailKey]) ||
    (nameKey && cache[nameKey]);

  if (cached && cached.name) {
    const isCachedAdmin = isKnownAdmin({
      name: cached.name,
      email: cached.email || project.authorEmail,
      role: cached.role || project.authorRole,
      id: cached.id || project.authorId,
    });
    return {
      name: cached.name,
      avatarUrl: cached.avatarUrl || project.authorAvatar || '',
      role: isCachedAdmin ? 'admin' : (cached.role || project.authorRole || 'author'),
      authorId: cached.id || project.authorId || '',
      isCurrentUser: false,
    };
  }

  // 3. Fallback to static snapshot on project
  const isAuthorAdmin = isKnownAdmin({
    name: project.author,
    email: project.authorEmail,
    role: project.authorRole,
    id: project.authorId,
  });

  return {
    name: project.author || 'Maker',
    avatarUrl: project.authorAvatar || '',
    role: isAuthorAdmin ? 'admin' : (project.authorRole || 'author'),
    authorId: project.authorId || '',
    isCurrentUser: false,
  };
}

/**
 * Synchronizes author profile changes across all stored projects belonging to this author.
 */
export function syncAuthorProfileAcrossProjects(
  authorIdentifier: {
    id?: string | number | null;
    email?: string | null;
    name?: string | null;
  },
  updates: {
    name?: string;
    avatarUrl?: string;
    role?: string;
    email?: string;
  }
): number {
  const all = getStoredProjects();
  if (!Array.isArray(all) || all.length === 0) return 0;

  const targetId =
    authorIdentifier.id !== undefined && authorIdentifier.id !== null
      ? String(authorIdentifier.id).toLowerCase()
      : '';
  const targetEmail = (authorIdentifier.email || '').trim().toLowerCase();
  const targetName = (authorIdentifier.name || '').trim().toLowerCase();

  let modifiedCount = 0;

  const updatedProjects = all.map((project) => {
    const pId = project.authorId ? String(project.authorId).toLowerCase() : '';
    const pEmail = (project.authorEmail || '').trim().toLowerCase();
    const pName = (project.author || '').trim().toLowerCase();

    const matchId = Boolean(targetId && pId && pId === targetId);
    const matchEmail = Boolean(targetEmail && pEmail && pEmail === targetEmail);
    const matchName = Boolean(
      targetName && pName && (pName === targetName || pName.includes(targetName) || targetName.includes(pName))
    );

    if (matchId || matchEmail || matchName) {
      modifiedCount++;
      const updatedP: ProjectDetail = {
        ...project,
        author: updates.name !== undefined && updates.name.trim() ? updates.name.trim() : project.author,
        authorAvatar: updates.avatarUrl !== undefined ? updates.avatarUrl : project.authorAvatar,
        authorRole: updates.role !== undefined ? updates.role : project.authorRole,
        authorId: targetId ? String(authorIdentifier.id) : project.authorId,
        authorEmail: updates.email || authorIdentifier.email || project.authorEmail,
      };
      // Asynchronously update in DB
      api.projects.update(project.id, updatedP).catch(() => {});
      return updatedP;
    }

    return project;
  });

  if (modifiedCount > 0) {
    persistProjects(updatedProjects);
  }

  saveKnownAuthor({
    id: targetId || undefined,
    email: targetEmail || undefined,
    name: updates.name || authorIdentifier.name || '',
    avatarUrl: updates.avatarUrl,
    role: updates.role,
  });

  return modifiedCount;
}

/**
 * Automatically inspects stored projects and retro-links them to the currently authenticated user
 * if they were created by them.
 */
export function syncCurrentUserProjects(currentUser?: any, currentProfile?: any): number {
  if (!currentUser && !currentProfile) return 0;

  const userId =
    currentProfile?.id !== undefined && currentProfile?.id !== null
      ? String(currentProfile.id)
      : (currentUser?.id ? String(currentUser.id) : '');
  const userEmail = currentProfile?.email || currentUser?.email || '';
  const userName =
    currentProfile?.name ||
    currentUser?.user_metadata?.name ||
    currentUser?.user_metadata?.full_name ||
    (userEmail ? userEmail.split('@')[0] : '');
  const userAvatar = currentProfile?.avatarUrl || currentUser?.user_metadata?.avatar_url || '';
  const isCurrAdmin = isKnownAdmin({
    name: userName,
    email: userEmail,
    role: currentProfile?.role,
    id: userId,
  });
  const userRole = isCurrAdmin ? 'admin' : (currentProfile?.role || 'author');

  if (!userName && !userId) return 0;

  const all = getStoredProjects();
  let modifiedCount = 0;

  const updatedProjects = all.map((project) => {
    if (isProjectAuthor(project, currentUser, currentProfile)) {
      const needsUpdate =
        project.author !== userName ||
        project.authorAvatar !== userAvatar ||
        (userId && project.authorId !== userId) ||
        (userRole && project.authorRole !== userRole);

      if (needsUpdate) {
        modifiedCount++;
        const updatedP = {
          ...project,
          author: userName || project.author,
          authorAvatar: userAvatar || project.authorAvatar,
          authorRole: userRole || project.authorRole,
          authorId: userId || project.authorId,
          authorEmail: userEmail || project.authorEmail,
        };
        api.projects.update(project.id, updatedP).catch(() => {});
        return updatedP;
      }
    }
    return project;
  });

  if (modifiedCount > 0) {
    persistProjects(updatedProjects);
  }

  saveKnownAuthor({
    id: userId,
    email: userEmail,
    name: userName,
    avatarUrl: userAvatar,
    role: userRole,
  });

  return modifiedCount;
}

function persistProjects(projects: ProjectDetail[]): void {
  memoryProjectsCache = projects;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
    }
  } catch (err) {
    console.error('Failed to update local project state:', err);
  }
}

/**
 * Merges projects returned by /api/auth/me (contributedProjects) into the active project store.
 */
export function mergeBackendAuthorProjects(authorProjects: any[]): void {
  if (!Array.isArray(authorProjects) || authorProjects.length === 0) return;

  const all = [...getStoredProjects()];
  let changed = false;

  for (const raw of authorProjects) {
    const id = String(raw.id || raw.slug || '').toLowerCase();
    if (!id) continue;

    const existingIdx = all.findIndex((p) => p.id.toLowerCase() === id);
    const normalized: ProjectDetail = {
      id: raw.id || raw.slug,
      title: raw.title || 'Untitled Project',
      publishDate: raw.publishDate || '',
      type: raw.type || 'Project',
      level: Number(raw.level) || 1,
      author: raw.author || 'Maker',
      authorAvatar: raw.authorAvatar || '',
      authorRole: raw.authorRole || 'author',
      authorId: raw.authorId || '',
      authorEmail: raw.authorEmail || '',
      status: raw.status || 'published',
      visibility: raw.visibility || 'public',
      flashCount: Number(raw.flashCount) || 0,
      featured: Boolean(raw.featured ?? raw.isFeatured),
      isFeatured: Boolean(raw.featured ?? raw.isFeatured),
      description: raw.description || raw.shortDescription || '',
      coverImage: raw.coverImage || raw.coverImageUrl || '/images/Place Holder.png',
      docLink: raw.docLink || '',
      githubLink: raw.githubLink || '',
      videoLink: raw.videoLink || '',
      projectMdFile: raw.projectMdFile || null,
      markdownContent: raw.markdownContent || '',
      compatibleBoard: raw.compatibleBoard || 'UNIHIKER K10',
      license: raw.license || 'MIT',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      firmwares: Array.isArray(raw.firmwares) ? raw.firmwares : [],
      attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    };

    if (existingIdx >= 0) {
      all[existingIdx] = { ...all[existingIdx], ...normalized };
      changed = true;
    } else {
      all.unshift(normalized);
      changed = true;
    }
  }

  if (changed) {
    persistProjects(all);
  }
}

/**
 * Returns all active projects and tutorials (regardless of status).
 */
export function getAllProjects(): ProjectDetail[] {
  return getStoredProjects();
}

/**
 * Returns only approved, public projects for the main catalog.
 */
export function getPublicProjects(): ProjectDetail[] {
  return getStoredProjects().filter(
    (p) => (p.status === 'published' || !p.status) && (p.visibility === 'public' || !p.visibility)
  );
}

/**
 * Returns pending projects waiting for admin verification.
 */
export function getPendingProjects(): ProjectDetail[] {
  return getStoredProjects().filter((p) => p.status === 'pending_approval');
}

/**
 * Returns projects created by a specific author (by ID or author name).
 */
export function getAuthorProjects(authorIdOrName?: string): ProjectDetail[] {
  if (!authorIdOrName) return [];
  const query = authorIdOrName.trim().toLowerCase();
  return getStoredProjects().filter(
    (p) => (p.authorId && p.authorId.toLowerCase() === query) || (p.author && p.author.toLowerCase() === query)
  );
}

/**
 * Returns a specific project or tutorial by ID/slug.
 */
export function getProjectById(id: string): ProjectDetail | undefined {
  if (!id) return undefined;
  const cleanId = id.trim().toLowerCase();
  const all = getStoredProjects();
  const found = all.find((p) => p.id.toLowerCase() === cleanId);
  if (!found) {
    // If not found in memory cache, kick off background refresh
    refreshProjectsFromBackend().catch(() => {});
  }
  return found;
}

/**
 * Formats a Date into 'DD MMM YYYY, hh:mm A' (e.g. '09 Sep 2026, 06:48 PM')
 * automatically picking current date and time.
 */
export function formatCurrentPublishDate(input?: Date | string | number): string {
  let d = new Date();
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'number') {
    d = new Date(input);
  } else if (typeof input === 'string' && input.trim()) {
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }

  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');

  return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
}

/**
 * Creates or updates a project/tutorial in both memory cache and backend database.
 * Automatically stamps publishDate and firmware releaseDate.
 */
export async function saveProjectAsync(project: ProjectDetail): Promise<ProjectDetail> {
  const currentDate = formatCurrentPublishDate();

  const firmwares = Array.isArray(project.firmwares) && project.firmwares.length > 0
    ? project.firmwares.map(f => ({
        ...f,
        releaseDate: f.releaseDate && f.releaseDate.trim() ? f.releaseDate : currentDate,
      }))
    : [
        {
          version: 'v1.0.0',
          name: `${project.title} Default Build`,
          releaseDate: currentDate,
          firmwareUrl: '',
          flashAddress: '0x00',
          versionNote: '',
        }
      ];

  const toSave: ProjectDetail = {
    ...project,
    title: censorBadWords(project.title || ''),
    description: censorBadWords(project.description || ''),
    author: censorBadWords(project.author || ''),
    markdownContent: project.markdownContent ? censorBadWords(project.markdownContent) : project.markdownContent,
    tags: Array.isArray(project.tags) ? project.tags.map((t) => censorBadWords(t)) : [],
    status: project.status || 'draft',
    visibility: project.visibility || (project.status === 'published' ? 'public' : 'draft'),
    publishDate: project.publishDate || (project.status === 'published' ? currentDate : ''),
    coverImage: normalizeImageUrl(project.coverImage) || project.coverImage || '/images/Place Holder.png',
    projectMdFile: normalizeMarkdownUrl(project.projectMdFile) || null,
    license: project.license || 'MIT',
    flashCount: typeof project.flashCount === 'number' ? project.flashCount : 0,
    featured: Boolean(project.featured ?? project.isFeatured ?? false),
    isFeatured: Boolean(project.featured ?? project.isFeatured ?? false),
    firmwares: firmwares.map((f) => ({
      ...f,
      name: censorBadWords(f.name || ''),
      versionNote: censorBadWords(f.versionNote || ''),
    })),
    attachments: Array.isArray(project.attachments)
      ? project.attachments.map((a) => ({
          name: censorBadWords(a.name || ''),
          fileUrl: a.fileUrl || '',
          fileSize: a.fileSize || undefined,
          fileType: a.fileType || undefined,
        }))
      : [],
  };

  // Optimistically update memory and storage
  const all = [...getStoredProjects()];
  const existingIdx = all.findIndex((p) => p.id.toLowerCase() === toSave.id.toLowerCase());
  if (existingIdx >= 0) {
    all[existingIdx] = toSave;
  } else {
    all.unshift(toSave);
  }
  persistProjects(all);

  // Persist directly to backend database
  try {
    const res = await api.projects.save(toSave);
    if (res && res.data) {
      const persisted = { ...toSave, ...res.data };
      const currentAll = [...memoryProjectsCache];
      const idx = currentAll.findIndex((p) => p.id.toLowerCase() === toSave.id.toLowerCase());
      if (idx >= 0) {
        currentAll[idx] = persisted;
      }
      persistProjects(currentAll);
      return persisted;
    }
  } catch (err) {
    console.error('Failed to persist project to backend DB:', err);
  }

  return toSave;
}

/**
 * Synchronous wrapper for saveProject to maintain complete backward compatibility.
 */
export function saveProject(project: ProjectDetail): ProjectDetail {
  const all = [...getStoredProjects()];
  const existingIdx = all.findIndex((p) => p.id.toLowerCase() === project.id.toLowerCase());
  const currentDate = formatCurrentPublishDate();

  const firmwares = Array.isArray(project.firmwares) && project.firmwares.length > 0
    ? project.firmwares.map(f => ({
        ...f,
        releaseDate: f.releaseDate && f.releaseDate.trim() ? f.releaseDate : currentDate,
      }))
    : [
        {
          version: 'v1.0.0',
          name: `${project.title} Default Build`,
          releaseDate: currentDate,
          firmwareUrl: '',
          flashAddress: '0x00',
          versionNote: '',
        }
      ];

  const toSave: ProjectDetail = {
    ...project,
    title: censorBadWords(project.title || ''),
    description: censorBadWords(project.description || ''),
    author: censorBadWords(project.author || ''),
    markdownContent: project.markdownContent ? censorBadWords(project.markdownContent) : project.markdownContent,
    tags: Array.isArray(project.tags) ? project.tags.map((t) => censorBadWords(t)) : [],
    status: project.status || 'draft',
    visibility: project.visibility || (project.status === 'published' ? 'public' : 'draft'),
    publishDate: project.publishDate || (project.status === 'published' ? currentDate : ''),
    coverImage: normalizeImageUrl(project.coverImage) || project.coverImage || '/images/Place Holder.png',
    projectMdFile: normalizeMarkdownUrl(project.projectMdFile) || null,
    license: project.license || 'MIT',
    flashCount: typeof project.flashCount === 'number' ? project.flashCount : 0,
    featured: Boolean(project.featured ?? project.isFeatured ?? false),
    isFeatured: Boolean(project.featured ?? project.isFeatured ?? false),
    firmwares: firmwares.map((f) => ({
      ...f,
      name: censorBadWords(f.name || ''),
      versionNote: censorBadWords(f.versionNote || ''),
    })),
    attachments: Array.isArray(project.attachments)
      ? project.attachments.map((a) => ({
          name: censorBadWords(a.name || ''),
          fileUrl: a.fileUrl || '',
          fileSize: a.fileSize || undefined,
          fileType: a.fileType || undefined,
        }))
      : [],
  };

  if (existingIdx >= 0) {
    all[existingIdx] = toSave;
  } else {
    all.unshift(toSave);
  }

  persistProjects(all);

  // Background DB sync
  api.projects.save(toSave).catch((err) => {
    console.warn('Background project DB save notice:', err);
  });

  return toSave;
}

/**
 * Admin action: toggles featured status of a project or tutorial.
 */
export function toggleFeaturedProject(id: string): boolean {
  if (!id) return false;
  const cleanId = id.trim().toLowerCase();
  const all = [...getStoredProjects()];
  const project = all.find((p) => p.id.toLowerCase() === cleanId);
  if (!project) return false;

  const nextVal = !(project.featured || project.isFeatured);
  project.featured = nextVal;
  project.isFeatured = nextVal;

  persistProjects(all);

  // Sync with DB
  api.projects.toggleFeatured(cleanId).catch(() => {});
  return true;
}

/**
 * Admin action: sets explicit featured status of a project or tutorial.
 */
export function setProjectFeatured(id: string, featured: boolean): boolean {
  if (!id) return false;
  const cleanId = id.trim().toLowerCase();
  const all = [...getStoredProjects()];
  const project = all.find((p) => p.id.toLowerCase() === cleanId);
  if (!project) return false;

  project.featured = featured;
  project.isFeatured = featured;

  persistProjects(all);
  api.projects.update(cleanId, { featured }).catch(() => {});
  return true;
}

/**
 * Returns all featured public projects and tutorials.
 */
export function getFeaturedProjects(): ProjectDetail[] {
  const publicList = getPublicProjects();
  const explicitlyFeatured = publicList.filter((p) => p.featured || p.isFeatured);
  if (explicitlyFeatured.length > 0) {
    return explicitlyFeatured;
  }
  return publicList.slice(0, 6);
}

/**
 * Admin action: approves a project, making it published and public.
 */
export function approveProject(id: string): boolean {
  if (!id) return false;
  const cleanId = id.trim().toLowerCase();
  const all = [...getStoredProjects()];
  const project = all.find((p) => p.id.toLowerCase() === cleanId);
  if (!project) return false;

  const currentDate = formatCurrentPublishDate();
  project.status = 'published';
  project.visibility = 'public';
  project.publishDate = project.publishDate || currentDate;

  persistProjects(all);
  api.projects.update(cleanId, { status: 'published', visibility: 'public', publishDate: project.publishDate }).catch(() => {});
  return true;
}

/**
 * Admin action: rejects a project.
 */
export function rejectProject(id: string): boolean {
  if (!id) return false;
  const cleanId = id.trim().toLowerCase();
  const all = [...getStoredProjects()];
  const project = all.find((p) => p.id.toLowerCase() === cleanId);
  if (!project) return false;

  project.status = 'rejected';
  project.visibility = 'draft';

  persistProjects(all);
  api.projects.update(cleanId, { status: 'rejected', visibility: 'draft' }).catch(() => {});
  return true;
}

/**
 * Deletes a project by ID across cache and backend database.
 */
export function deleteProject(id: string): boolean {
  if (!id) return false;
  const cleanId = id.trim().toLowerCase();
  const all = getStoredProjects();
  const filtered = all.filter((p) => p.id.toLowerCase() !== cleanId);

  if (filtered.length !== all.length) {
    persistProjects(filtered);
    api.projects.delete(cleanId).catch((err) => {
      console.warn('Backend delete project notice:', err);
    });
    return true;
  }
  return false;
}

/**
 * Updates the flash count of a project in memory and notifies subscribers.
 */
export function updateProjectFlashCountInMemory(id: string, count: number): void {
  if (!id) return;
  const cleanId = id.trim().toLowerCase();
  const all = [...getStoredProjects()];
  const project = all.find((p) => p.id.toLowerCase() === cleanId);
  if (project) {
    project.flashCount = count;
    persistProjects(all);
  }
}

/**
 * Subscribes to real-time updates when projects are added, edited, or removed.
 */
export function subscribeProjects(callback: (projects: ProjectDetail[]) => void): () => void {
  const handleUpdate = () => callback(getStoredProjects());

  window.addEventListener(UPDATE_EVENT, handleUpdate);
  window.addEventListener('storage', handleUpdate);

  // Trigger once immediately if projects exist
  if (memoryProjectsCache.length > 0) {
    callback(memoryProjectsCache);
  }

  return () => {
    window.removeEventListener(UPDATE_EVENT, handleUpdate);
    window.removeEventListener('storage', handleUpdate);
  };
}

/**
 * Converts a video URL (YouTube, Vimeo, direct MP4) into an embeddable player URL.
 */
export function parseVideoEmbedUrl(url?: string): { type: 'youtube' | 'vimeo' | 'mp4' | 'unknown'; embedUrl: string } | null {
  if (!url || !url.trim()) return null;
  const clean = url.trim();

  // YouTube (standard watch, shortened youtu.be, or embed)
  const ytMatch = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
    };
  }

  // Vimeo
  const vimeoMatch = clean.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}`,
    };
  }

  // Direct MP4 / WebM video file
  if (clean.endsWith('.mp4') || clean.endsWith('.webm')) {
    return {
      type: 'mp4',
      embedUrl: clean,
    };
  }

  return {
    type: 'unknown',
    embedUrl: clean,
  };
}

/**
 * Automatically converts GitHub repository blob URLs into direct raw content URLs.
 * e.g. https://github.com/:user/:repo/blob/:branch/path.png -> https://raw.githubusercontent.com/:user/:repo/:branch/path.png
 */
export function normalizeImageUrl(url?: string): string {
  if (!url || !url.trim()) return '';
  return convertGithubBlobToRaw(url);
}

/**
 * Automatically converts any GitHub markdown URL (blob, raw, or branch direct)
 * into a CORS-friendly raw.githubusercontent.com URL.
 */
export function normalizeMarkdownUrl(url?: string | null): string {
  if (!url || !url.trim()) return '';
  return convertGithubBlobToRaw(url);
}
