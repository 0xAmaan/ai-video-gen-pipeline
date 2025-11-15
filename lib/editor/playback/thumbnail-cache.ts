/**
 * Cache for video thumbnails using LRU eviction strategy.
 * Stores thumbnail data URLs keyed by asset ID.
 */
export class ThumbnailCache {
  private cache = new Map<string, string[]>();
  private maxEntries: number;

  constructor(maxEntries: number = 50) {
    this.maxEntries = maxEntries;
  }

  /**
   * Get thumbnails for an asset. Returns undefined if not cached.
   * Moves the entry to the end (most recently used).
   */
  get(assetId: string): string[] | undefined {
    const thumbnails = this.cache.get(assetId);
    if (thumbnails) {
      // Move to end (most recently used)
      this.cache.delete(assetId);
      this.cache.set(assetId, thumbnails);
    }
    return thumbnails;
  }

  /**
   * Store thumbnails for an asset.
   * Evicts oldest entry if cache is full.
   */
  put(assetId: string, thumbnails: string[]): void {
    // Remove if already exists (to update position)
    if (this.cache.has(assetId)) {
      this.cache.delete(assetId);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(assetId, thumbnails);
  }

  /**
   * Check if thumbnails are cached for an asset.
   */
  has(assetId: string): boolean {
    return this.cache.has(assetId);
  }

  /**
   * Remove thumbnails for an asset.
   */
  delete(assetId: string): void {
    this.cache.delete(assetId);
  }

  /**
   * Clear all cached thumbnails.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size.
   */
  get size(): number {
    return this.cache.size;
  }
}

let singleton: ThumbnailCache | null = null;

/**
 * Get or create the singleton ThumbnailCache instance.
 */
export const getThumbnailCache = (): ThumbnailCache => {
  if (!singleton) {
    singleton = new ThumbnailCache();
  }
  return singleton;
};
