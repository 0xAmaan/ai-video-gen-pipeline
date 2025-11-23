const DB_NAME = 'ThumbnailCache';
const DB_VERSION = 1;
const STORE_NAME = 'thumbnails';

interface CachedThumbnail {
  assetId: string;
  urls: string[];
  timestamp: number;
  version: number; // For cache invalidation
}

/**
 * Cache for video thumbnails using LRU eviction strategy.
 * Stores thumbnail URLs (R2 or data URLs) keyed by asset ID.
 * Persists to IndexedDB for cross-session caching.
 */
export class ThumbnailCache {
  private cache = new Map<string, string[]>();
  private maxEntries: number;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;
  private readonly CACHE_VERSION = 1; // Increment to invalidate all caches

  constructor(maxEntries: number = 50) {
    this.maxEntries = maxEntries;
    this.initPromise = this.initIndexedDB();
  }

  /**
   * Initialize IndexedDB connection and load cached entries.
   */
  private async initIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available, thumbnail cache will be memory-only');
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'assetId' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      this.db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Load existing cache entries into memory
      await this.loadFromIndexedDB();
    } catch (error) {
      console.error('Failed to initialize IndexedDB cache:', error);
    }
  }

  /**
   * Load cache entries from IndexedDB into memory.
   */
  private async loadFromIndexedDB(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      const entries: CachedThumbnail[] = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Filter by version and sort by timestamp (oldest first)
      const validEntries = entries
        .filter(entry => entry.version === this.CACHE_VERSION)
        .sort((a, b) => a.timestamp - b.timestamp);

      // Load most recent entries up to maxEntries
      const entriesToLoad = validEntries.slice(-this.maxEntries);
      
      for (const entry of entriesToLoad) {
        this.cache.set(entry.assetId, entry.urls);
      }

      console.log(`Loaded ${entriesToLoad.length} thumbnails from IndexedDB cache`);

      // Clean up old entries
      if (validEntries.length > this.maxEntries) {
        await this.evictOldEntries(validEntries.slice(0, -this.maxEntries).map(e => e.assetId));
      }
    } catch (error) {
      console.error('Failed to load from IndexedDB:', error);
    }
  }

  /**
   * Save a cache entry to IndexedDB.
   */
  private async saveToIndexedDB(assetId: string, urls: string[]): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const entry: CachedThumbnail = {
        assetId,
        urls,
        timestamp: Date.now(),
        version: this.CACHE_VERSION,
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error);
    }
  }

  /**
   * Remove entries from IndexedDB.
   */
  private async evictOldEntries(assetIds: string[]): Promise<void> {
    if (!this.db || assetIds.length === 0) return;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      for (const assetId of assetIds) {
        store.delete(assetId);
      }

      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Failed to evict from IndexedDB:', error);
    }
  }

  /**
   * Get thumbnails for an asset. Returns undefined if not cached.
   * Moves the entry to the end (most recently used).
   * Async to ensure IndexedDB is initialized.
   */
  async get(assetId: string): Promise<string[] | undefined> {
    await this.initPromise; // Ensure DB is ready
    
    const thumbnails = this.cache.get(assetId);
    if (thumbnails) {
      // Move to end (most recently used)
      this.cache.delete(assetId);
      this.cache.set(assetId, thumbnails);
      
      // Update timestamp in IndexedDB
      this.saveToIndexedDB(assetId, thumbnails).catch(err =>
        console.error('Failed to update timestamp:', err)
      );
    }
    return thumbnails;
  }

  /**
   * Store thumbnails for an asset.
   * Evicts oldest entry if cache is full.
   * Persists to IndexedDB.
   */
  async put(assetId: string, thumbnails: string[]): Promise<void> {
    await this.initPromise; // Ensure DB is ready

    // Remove if already exists (to update position)
    if (this.cache.has(assetId)) {
      this.cache.delete(assetId);
    }

    // Evict oldest if at capacity
    const evictedKeys: string[] = [];
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        evictedKeys.push(firstKey);
      }
    }

    this.cache.set(assetId, thumbnails);

    // Persist to IndexedDB
    await Promise.all([
      this.saveToIndexedDB(assetId, thumbnails),
      evictedKeys.length > 0 ? this.evictOldEntries(evictedKeys) : Promise.resolve(),
    ]);
  }

  /**
   * Check if thumbnails are cached for an asset.
   */
  has(assetId: string): boolean {
    return this.cache.has(assetId);
  }

  /**
   * Remove thumbnails for an asset from both memory and IndexedDB.
   */
  async delete(assetId: string): Promise<void> {
    await this.initPromise;
    this.cache.delete(assetId);
    await this.evictOldEntries([assetId]);
  }

  /**
   * Clear all cached thumbnails from memory and IndexedDB.
   */
  async clear(): Promise<void> {
    await this.initPromise;
    this.cache.clear();
    
    if (this.db) {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await new Promise<void>((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error('Failed to clear IndexedDB:', error);
      }
    }
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
