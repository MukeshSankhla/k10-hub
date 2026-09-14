// downloadService.ts
// Handles downloading remote firmware binaries with progress reporting and caching.
import { convertGithubBlobToRaw } from '../../utils/githubUrl';

const binaryCache: Record<string, Uint8Array> = {};

export const downloadService = {
  /**
   * Downloads a binary file from a remote URL with progress callbacks
   */
  async downloadFile(
    url: string,
    onProgress?: (downloadedBytes: number, totalBytes: number) => void
  ): Promise<Uint8Array> {
    const targetUrl = convertGithubBlobToRaw(url);

    // Check in-memory cache first
    if (binaryCache[targetUrl]) {
      const cached = binaryCache[targetUrl];
      if (onProgress) onProgress(cached.length, cached.length);
      return cached;
    }

    try {
      const response = await fetch(targetUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      if (!response.body) {
        // Fallback to arrayBuffer if streaming body is not present
        const buffer = await response.arrayBuffer();
        const binaryData = new Uint8Array(buffer);
        binaryCache[url] = binaryData;
        if (onProgress) onProgress(binaryData.length, binaryData.length);
        return binaryData;
      }

      const reader = response.body.getReader();
      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        if (onProgress) {
          onProgress(receivedBytes, totalBytes);
        }
      }

      // Concatenate chunks into a single Uint8Array
      const binaryData = new Uint8Array(receivedBytes);
      let position = 0;
      for (const chunk of chunks) {
        binaryData.set(chunk, position);
        position += chunk.length;
      }

      // Store in cache
      binaryCache[url] = binaryData;
      return binaryData;
    } catch (error: any) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error(
          'Failed to download firmware binary. This can occur due to CORS policies or internet disconnection. Ensure the firmware file is accessible.'
        );
      }
      throw error;
    }
  },

  /**
   * Clears cached binary downloads
   */
  clearCache() {
    for (const key of Object.keys(binaryCache)) {
      delete binaryCache[key];
    }
  },

  /**
   * Helper to format byte counts into readable strings (KB, MB)
   */
  formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },
};
