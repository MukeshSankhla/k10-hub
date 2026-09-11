// flashCountService.ts
// Real-time flash count tracking directly connected to the K10 Hub SQLite backend database.

import { api } from '../api';
import { updateProjectFlashCountInMemory } from '../projects/projectStorageService';

const FLASH_EVENT = 'k10_flash_count_updated';

// In-memory flash count cache for immediate zero-latency UI reads
const inMemoryCounts = new Map<string, number>();

/**
 * Retrieves the currently known flash count synchronously from memory or storage.
 */
export function getLocalFlashCount(projectId: string): number {
  if (!projectId) return 0;
  const cleanId = projectId.trim().toLowerCase();

  if (inMemoryCounts.has(cleanId)) {
    return inMemoryCounts.get(cleanId)!;
  }

  try {
    const stored = localStorage.getItem(`k10_flash_count_${cleanId}`);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        inMemoryCounts.set(cleanId, parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore storage read error
  }
  return 0;
}

/**
 * Updates the flash count in memory, localStorage, and notifies listeners.
 */
export function setLocalFlashCount(projectId: string, count: number): void {
  if (!projectId || typeof count !== 'number') return;
  const cleanId = projectId.trim().toLowerCase();

  inMemoryCounts.set(cleanId, count);

  try {
    localStorage.setItem(`k10_flash_count_${cleanId}`, String(count));
  } catch {
    // Ignore storage write error
  }

  // Update in-memory project detail so ProjectCard and ProjectDetailPage reflect immediately
  updateProjectFlashCountInMemory(cleanId, count);

  // Notify active listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(FLASH_EVENT, { detail: { projectId: cleanId, count } })
    );
  }
}

/**
 * Retrieves the current verified flash count for a specific project directly from the backend DB.
 */
export async function getProjectFlashCount(projectId: string): Promise<number> {
  if (!projectId) return 0;
  const cleanId = projectId.trim().toLowerCase();
  const current = getLocalFlashCount(cleanId);

  try {
    const res = await api.projects.get(cleanId);
    if (res && res.data && typeof res.data.flashCount === 'number') {
      const dbCount = res.data.flashCount;
      setLocalFlashCount(cleanId, dbCount);
      return dbCount;
    }
  } catch (error) {
    // Silently fall back to cached count if network unavailable
  }

  return current;
}

/**
 * Atomically increments the flash count for a project in the backend SQLite DB.
 */
export async function incrementProjectFlashCount(projectId: string, _version = ''): Promise<number> {
  if (!projectId) return 0;
  const cleanId = projectId.trim().toLowerCase();

  // Optimistic increment for instant UI feedback
  const optimisticCount = getLocalFlashCount(cleanId) + 1;
  setLocalFlashCount(cleanId, optimisticCount);

  try {
    // Call backend API: POST /api/projects/:id/flash
    const res = await api.projects.flash(cleanId);
    if (res && typeof res.flashCount === 'number') {
      setLocalFlashCount(cleanId, res.flashCount);
      return res.flashCount;
    }
  } catch (err) {
    console.warn('Backend flash count increment sync notice:', err);
  }

  return optimisticCount;
}

/**
 * Subscribes to flash count updates for a specific project.
 */
export function subscribeProjectFlashCount(
  projectId: string,
  callback: (count: number) => void
): () => void {
  if (!projectId || typeof callback !== 'function') return () => {};
  const cleanId = projectId.trim().toLowerCase();

  // Fire immediately with current value
  callback(getLocalFlashCount(cleanId));

  // Asynchronously query the DB to ensure latest count
  getProjectFlashCount(cleanId).then((dbCount) => {
    callback(dbCount);
  }).catch(() => {});

  const handleUpdate = (e: Event) => {
    const customEvent = e as CustomEvent<{ projectId: string; count: number }>;
    if (customEvent.detail && customEvent.detail.projectId === cleanId) {
      callback(customEvent.detail.count);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(FLASH_EVENT, handleUpdate);
    window.addEventListener('storage', () => {
      callback(getLocalFlashCount(cleanId));
    });
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(FLASH_EVENT, handleUpdate);
    }
  };
}
