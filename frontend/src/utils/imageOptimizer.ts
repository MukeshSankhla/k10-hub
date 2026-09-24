/**
 * Utility to optimize project card cover images for fast rendering,
 * responsive delivery, and bandwidth efficiency.
 */

// Memory cache of image URLs already loaded in this session to prevent re-flicker on client navigation
export const loadedImagesCache = new Set<string>();

export function isImagePreloaded(url: string): boolean {
  return loadedImagesCache.has(url);
}

export function markImageLoaded(url: string): void {
  if (url) loadedImagesCache.add(url);
}

/**
 * Optimizes external image URLs (like Unsplash, GitHub) to appropriate dimensions,
 * WebP/modern formats, and edge-cached CDN mirrors.
 */
export function optimizeCardImageUrl(rawUrl: string, width = 600): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '/images/Place Holder.png';
  }

  const url = rawUrl.trim();
  if (!url) return '/images/Place Holder.png';

  // 1. Unsplash: optimize width, format, and compression (reduces payload by up to 85%)
  if (url.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set('w', String(width));
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      parsed.searchParams.set('q', '75');
      return parsed.toString();
    } catch {
      let optimized = url.replace(/w=\d+/, `w=${width}`);
      if (!optimized.includes('auto=format')) optimized += '&auto=format';
      if (!optimized.includes('q=')) optimized += '&q=75';
      return optimized;
    }
  }

  // 2. GitHub Raw images: route through jsDelivr high-speed edge CDN
  // e.g., https://raw.githubusercontent.com/owner/repo/branch/path -> https://cdn.jsdelivr.net/gh/owner/repo@branch/path
  if (url.includes('raw.githubusercontent.com')) {
    const match = url.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/);
    if (match) {
      const [, owner, repo, branch, path] = match;
      return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`;
    }
  }

  return url;
}

/**
 * Generates an optimal responsive srcset for Unsplash images
 */
export function getCardImageSrcSet(rawUrl: string): string | undefined {
  if (!rawUrl || !rawUrl.includes('images.unsplash.com')) {
    return undefined;
  }
  return `${optimizeCardImageUrl(rawUrl, 380)} 380w, ${optimizeCardImageUrl(rawUrl, 640)} 640w, ${optimizeCardImageUrl(rawUrl, 900)} 900w`;
}
