import { describe, it, expect, beforeEach } from 'vitest';
import { ThumbnailCache, getThumbnailCache } from './thumbnail-cache';

describe('ThumbnailCache', () => {
  let cache: ThumbnailCache;

  beforeEach(() => {
    cache = new ThumbnailCache(3); // Small cache for easier testing
  });

  describe('Basic Operations', () => {
    it('should store and retrieve thumbnails', () => {
      const thumbnails = ['data:image/jpeg;base64,abc', 'data:image/jpeg;base64,def'];
      cache.put('asset-1', thumbnails);

      const retrieved = cache.get('asset-1');
      expect(retrieved).toEqual(thumbnails);
    });

    it('should return undefined for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.put('asset-1', ['thumb1']);

      expect(cache.has('asset-1')).toBe(true);
      expect(cache.has('asset-2')).toBe(false);
    });

    it('should delete entries', () => {
      cache.put('asset-1', ['thumb1']);
      expect(cache.has('asset-1')).toBe(true);

      cache.delete('asset-1');
      expect(cache.has('asset-1')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.put('asset-1', ['thumb1']);
      cache.put('asset-2', ['thumb2']);
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('should track cache size', () => {
      expect(cache.size).toBe(0);

      cache.put('asset-1', ['thumb1']);
      expect(cache.size).toBe(1);

      cache.put('asset-2', ['thumb2']);
      expect(cache.size).toBe(2);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict oldest entry when cache is full', () => {
      cache.put('asset-1', ['thumb1']);
      cache.put('asset-2', ['thumb2']);
      cache.put('asset-3', ['thumb3']);
      expect(cache.size).toBe(3);

      // Adding fourth item should evict asset-1 (oldest)
      cache.put('asset-4', ['thumb4']);
      expect(cache.size).toBe(3);
      expect(cache.has('asset-1')).toBe(false);
      expect(cache.has('asset-2')).toBe(true);
      expect(cache.has('asset-3')).toBe(true);
      expect(cache.has('asset-4')).toBe(true);
    });

    it('should update LRU order on get', () => {
      cache.put('asset-1', ['thumb1']);
      cache.put('asset-2', ['thumb2']);
      cache.put('asset-3', ['thumb3']);

      // Access asset-1, making it most recently used
      cache.get('asset-1');

      // Adding fourth item should now evict asset-2 (oldest)
      cache.put('asset-4', ['thumb4']);
      expect(cache.has('asset-1')).toBe(true);
      expect(cache.has('asset-2')).toBe(false);
      expect(cache.has('asset-3')).toBe(true);
      expect(cache.has('asset-4')).toBe(true);
    });

    it('should update LRU order on put', () => {
      cache.put('asset-1', ['thumb1']);
      cache.put('asset-2', ['thumb2']);
      cache.put('asset-3', ['thumb3']);

      // Update asset-1, making it most recently used
      cache.put('asset-1', ['thumb1-updated']);

      // Adding fourth item should evict asset-2 (oldest)
      cache.put('asset-4', ['thumb4']);
      expect(cache.has('asset-1')).toBe(true);
      expect(cache.has('asset-2')).toBe(false);
      expect(cache.has('asset-3')).toBe(true);
      expect(cache.has('asset-4')).toBe(true);
    });
  });

  describe('Update Behavior', () => {
    it('should update existing entry without changing size', () => {
      cache.put('asset-1', ['thumb1']);
      cache.put('asset-2', ['thumb2']);
      expect(cache.size).toBe(2);

      cache.put('asset-1', ['thumb1-updated', 'thumb1-new']);
      expect(cache.size).toBe(2);

      const retrieved = cache.get('asset-1');
      expect(retrieved).toEqual(['thumb1-updated', 'thumb1-new']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty thumbnails array', () => {
      cache.put('asset-1', []);
      const retrieved = cache.get('asset-1');
      expect(retrieved).toEqual([]);
    });

    it('should handle large thumbnails array', () => {
      const largeThumbnails = Array.from({ length: 100 }, (_, i) => `thumb${i}`);
      cache.put('asset-1', largeThumbnails);

      const retrieved = cache.get('asset-1');
      expect(retrieved).toHaveLength(100);
    });

    it('should handle maxEntries of 1', () => {
      const tinyCache = new ThumbnailCache(1);
      tinyCache.put('asset-1', ['thumb1']);
      expect(tinyCache.size).toBe(1);

      tinyCache.put('asset-2', ['thumb2']);
      expect(tinyCache.size).toBe(1);
      expect(tinyCache.has('asset-1')).toBe(false);
      expect(tinyCache.has('asset-2')).toBe(true);
    });

    it('should handle default maxEntries', () => {
      const defaultCache = new ThumbnailCache();
      // Default is 50
      for (let i = 0; i < 60; i++) {
        defaultCache.put(`asset-${i}`, [`thumb${i}`]);
      }

      expect(defaultCache.size).toBe(50);
      expect(defaultCache.has('asset-0')).toBe(false); // First 10 should be evicted
      expect(defaultCache.has('asset-10')).toBe(true);
      expect(defaultCache.has('asset-59')).toBe(true);
    });
  });
});

describe('getThumbnailCache (Singleton)', () => {
  it('should return the same instance', () => {
    const cache1 = getThumbnailCache();
    const cache2 = getThumbnailCache();

    expect(cache1).toBe(cache2);
  });

  it('should maintain state across calls', () => {
    const cache1 = getThumbnailCache();
    cache1.put('test-asset', ['thumb1', 'thumb2']);

    const cache2 = getThumbnailCache();
    const retrieved = cache2.get('test-asset');

    expect(retrieved).toEqual(['thumb1', 'thumb2']);
  });
});
