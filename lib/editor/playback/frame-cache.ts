export class FrameCache<T extends { close?: () => void } = { close?: () => void }> {
  private cache = new Map<string, T>();

  constructor(private readonly maxEntries = 120) {}

  get(key: string) {
    const value = this.cache.get(key);
    if (!value) return undefined;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  async put(key: string, frame: T) {
    if (this.cache.has(key)) {
      const existing = this.cache.get(key);
      existing?.close?.();
      this.cache.delete(key);
    }
    this.cache.set(key, frame);
    if (this.cache.size <= this.maxEntries) {
      return;
    }
    const oldestKey = this.cache.keys().next().value as string | undefined;
    if (oldestKey) {
      const oldest = this.cache.get(oldestKey);
      oldest?.close?.();
      this.cache.delete(oldestKey);
    }
  }

  clear() {
    for (const [, frame] of this.cache) {
      frame?.close?.();
    }
    this.cache.clear();
  }

  sweep(predicate: (key: string, frame: T) => boolean) {
    for (const [key, frame] of this.cache) {
      if (predicate(key, frame)) {
        frame?.close?.();
        this.cache.delete(key);
      }
    }
  }
}
