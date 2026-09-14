/**
 * Utility to convert GitHub file URLs to raw download URLs.
 *
 * Example:
 * Input:  https://github.com/MukeshSankhla/K10-Projects/blob/main/Ai%20Buddy/firmware_v21.1.bin
 * Output: https://raw.githubusercontent.com/MukeshSankhla/K10-Projects/main/Ai%20Buddy/firmware_v21.1.bin
 */

export function convertGithubBlobToRaw(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Pattern: https://github.com/:owner/:repo/(blob|raw)/:branch/:filePath...
  const githubBlobPattern = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/i;
  const match = trimmed.match(githubBlobPattern);

  if (match) {
    const [, owner, repo, rest] = match;
    // Encode space characters in path segments safely
    const encodedRest = rest
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
    return `https://raw.githubusercontent.com/${owner}/${repo}/${encodedRest}`;
  }

  // If it's already a raw.githubusercontent.com URL, ensure segments are properly encoded
  const rawPattern = /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+)$/i;
  const rawMatch = trimmed.match(rawPattern);
  if (rawMatch) {
    const [, owner, repo, rest] = rawMatch;
    const encodedRest = rest
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
    return `https://raw.githubusercontent.com/${owner}/${repo}/${encodedRest}`;
  }

  return trimmed;
}
