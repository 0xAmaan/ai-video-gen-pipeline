import type { Clip, MediaAssetMeta, Sequence } from "../types";
import type { FrameCallback, FrameMetrics } from "./performance-monitor";

export interface OptimizedFrameRendererOptions {
  // Performance options
  batchSize: number;
  enableParallelSeeking: boolean;
  frameBufferSize: number;
  
  // Quality options
  seekAccuracy: number; // seconds
  enablePreload: boolean;
  
  // Memory management
  maxVideoElements: number;
  enableGarbageCollection: boolean;
}

const DEFAULT_OPTIONS: OptimizedFrameRendererOptions = {
  batchSize: 8, // Process frames in batches
  enableParallelSeeking: true,
  frameBufferSize: 32, // Buffer up to 32 frames ahead
  seekAccuracy: 0.001, // 1ms accuracy
  enablePreload: true,
  maxVideoElements: 10, // Limit simultaneous video elements
  enableGarbageCollection: true,
};

export class OptimizedFrameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoElements = new Map<string, HTMLVideoElement>();
  private videoPool: HTMLVideoElement[] = [];
  private frameCache = new Map<string, ImageData>();
  private preloadedFrames = new Map<string, boolean>();
  private options: OptimizedFrameRendererOptions;
  
  // Performance tracking
  private onFrameMetrics?: (metrics: Partial<FrameMetrics>) => void;
  
  constructor(
    width: number, 
    height: number, 
    options?: Partial<OptimizedFrameRendererOptions>
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    this.ctx = ctx;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
  
  setFrameMetricsCallback(callback: (metrics: Partial<FrameMetrics>) => void): void {
    this.onFrameMetrics = callback;
  }

  async renderSequence(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
    fps: number,
    onFrame: FrameCallback,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const frameDuration = 1 / fps;
    const totalFrames = Math.ceil(sequence.duration * fps);

    // Preload videos optimally
    const preloadStart = performance.now();
    await this.optimizedPreloadVideos(sequence, assets);
    const preloadTime = performance.now() - preloadStart;
    
    console.log(`[Optimized Renderer] Preloaded videos in ${preloadTime.toFixed(2)}ms`);

    if (this.options.enableParallelSeeking) {
      await this.renderWithParallelProcessing(
        sequence, 
        assets, 
        totalFrames, 
        frameDuration, 
        onFrame, 
        onProgress
      );
    } else {
      await this.renderSequentially(
        sequence, 
        assets, 
        totalFrames, 
        frameDuration, 
        onFrame, 
        onProgress
      );
    }

    this.cleanup();
  }
  
  private async renderWithParallelProcessing(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
    totalFrames: number,
    frameDuration: number,
    onFrame: FrameCallback,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const batchSize = this.options.batchSize;
    let processedFrames = 0;
    
    for (let batchStart = 0; batchStart < totalFrames; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalFrames);
      const batch: Promise<void>[] = [];
      
      // Prepare batch of frames
      for (let frameIndex = batchStart; frameIndex < batchEnd; frameIndex++) {
        const timestamp = frameIndex * frameDuration;
        
        batch.push(this.renderFrameOptimized(
          sequence,
          assets,
          frameIndex,
          timestamp,
          onFrame
        ));
      }
      
      // Process batch in parallel
      await Promise.all(batch);
      
      processedFrames += batch.length;
      
      // Report progress
      if (onProgress) {
        const progress = (processedFrames / totalFrames) * 100;
        onProgress(progress);
      }
      
      // Memory management between batches
      if (this.options.enableGarbageCollection && batchStart % (batchSize * 4) === 0) {
        await this.performGarbageCollection();
      }
    }
  }
  
  private async renderSequentially(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
    totalFrames: number,
    frameDuration: number,
    onFrame: FrameCallback,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const timestamp = frameIndex * frameDuration;
      
      await this.renderFrameOptimized(
        sequence,
        assets,
        frameIndex,
        timestamp,
        onFrame
      );

      // Report progress
      if (onProgress) {
        const progress = ((frameIndex + 1) / totalFrames) * 100;
        onProgress(progress);
      }
      
      // Periodic memory management
      if (this.options.enableGarbageCollection && frameIndex % 100 === 0) {
        await this.performGarbageCollection();
      }
    }
  }

  private async renderFrameOptimized(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
    frameNumber: number,
    timestamp: number,
    onFrame: FrameCallback,
  ): Promise<void> {
    const renderStart = performance.now();
    
    // Check frame cache first
    const cacheKey = `${frameNumber}_${timestamp.toFixed(3)}`;
    const cachedFrame = this.frameCache.get(cacheKey);
    
    if (cachedFrame) {
      onFrame(cachedFrame, timestamp);
      return;
    }

    // Find clip at this timestamp
    const clip = this.resolveClip(sequence, timestamp);

    // Draw frame with performance tracking
    const seekStart = performance.now();
    await this.drawFrameOptimized(clip, timestamp, assets);
    const seekTime = performance.now() - seekStart;

    // Capture frame data
    const captureStart = performance.now();
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    const captureTime = performance.now() - captureStart;
    
    // Cache the frame if buffer allows
    if (this.frameCache.size < this.options.frameBufferSize) {
      this.frameCache.set(cacheKey, imageData);
    }

    onFrame(imageData, timestamp);
    
    const renderTime = performance.now() - renderStart;
    
    // Report frame metrics
    if (this.onFrameMetrics) {
      this.onFrameMetrics({
        frameNumber,
        timestamp,
        renderTime,
        seekTime,
        encodeTime: captureTime, // Using capture time as encode time approximation
      });
    }
  }

  private async optimizedPreloadVideos(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
  ): Promise<void> {
    const uniqueMediaIds = new Set<string>();

    for (const track of sequence.tracks) {
      for (const clip of track.clips) {
        uniqueMediaIds.add(clip.mediaId);
      }
    }

    // Limit concurrent video elements for memory efficiency
    const mediaArray = Array.from(uniqueMediaIds).slice(0, this.options.maxVideoElements);
    const batchSize = 3; // Load videos in small batches to avoid overwhelming the browser
    
    for (let i = 0; i < mediaArray.length; i += batchSize) {
      const batch = mediaArray.slice(i, i + batchSize);
      const loadPromises = batch.map(mediaId => this.loadVideo(mediaId, assets[mediaId]));
      
      try {
        await Promise.all(loadPromises);
      } catch (error) {
        console.warn('[Optimized Renderer] Some videos failed to load:', error);
        // Continue with remaining videos
      }
      
      // Small delay between batches to prevent browser lockup
      if (i + batchSize < mediaArray.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }
  
  private async loadVideo(mediaId: string, asset: MediaAssetMeta): Promise<void> {
    if (!asset || asset.type !== "video") return;
    
    // Reuse video element from pool if available
    let video = this.videoPool.pop();
    if (!video) {
      video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.playsInline = true;
      video.muted = true;
      video.preload = "metadata"; // Load only metadata initially
    }
    
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout loading video: ${asset.name}`));
      }, 10000); // 10 second timeout
      
      const onLoadedData = () => {
        clearTimeout(timeout);
        video.removeEventListener("loadeddata", onLoadedData);
        video.removeEventListener("error", onError);
        this.videoElements.set(mediaId, video);
        resolve();
      };
      
      const onError = (event: Event) => {
        clearTimeout(timeout);
        video.removeEventListener("loadeddata", onLoadedData);
        video.removeEventListener("error", onError);
        reject(new Error(`Failed to load video: ${asset.name}`));
      };
      
      video.addEventListener("loadeddata", onLoadedData, { once: true });
      video.addEventListener("error", onError, { once: true });
      
      video.src = asset.url;
      video.load();
    });
  }

  private async drawFrameOptimized(
    clip: Clip | undefined,
    timestamp: number,
    assets: Record<string, MediaAssetMeta>,
  ): Promise<void> {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Clear with black background
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (!clip) return;

    const video = this.videoElements.get(clip.mediaId);
    if (!video) return;

    // Calculate seek position
    const playheadWithinClip = timestamp - clip.start + clip.trimStart;
    
    // Optimized seeking with accuracy threshold
    const currentTime = video.currentTime;
    const seekDifference = Math.abs(currentTime - playheadWithinClip);
    
    if (seekDifference > this.options.seekAccuracy) {
      video.currentTime = playheadWithinClip;
      
      // For small seeks, don't wait for seeked event
      if (seekDifference > 0.1) {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked);

          // Shorter timeout for better performance
          setTimeout(resolve, 50);
        });
      }
    }

    // Optimized drawing with proper aspect ratio
    this.drawVideoToCanvas(video);
  }
  
  private drawVideoToCanvas(video: HTMLVideoElement): void {
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
    
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth: number;
    let drawHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspect > canvasAspect) {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / videoAspect;
      offsetY = (canvasHeight - drawHeight) / 2;
    } else {
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * videoAspect;
      offsetX = (canvasWidth - drawWidth) / 2;
    }

    // Use more efficient drawing method
    this.ctx.imageSmoothingEnabled = false; // Disable smoothing for performance
    this.ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    this.ctx.imageSmoothingEnabled = true; // Re-enable for future operations
  }

  private resolveClip(sequence: Sequence, time: number): Clip | undefined {
    // Optimize by checking video tracks first (most common)
    for (const track of sequence.tracks) {
      if (track.kind !== "video") continue;
      for (const clip of track.clips) {
        if (time >= clip.start && time < clip.start + clip.duration) {
          return clip;
        }
      }
    }
    return undefined;
  }
  
  private async performGarbageCollection(): Promise<void> {
    // Clear frame cache periodically
    if (this.frameCache.size > this.options.frameBufferSize) {
      const keysToDelete = Array.from(this.frameCache.keys())
        .slice(0, Math.floor(this.frameCache.size / 2));
      
      keysToDelete.forEach(key => this.frameCache.delete(key));
    }
    
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch {
        // Ignore errors
      }
    }
    
    // Small delay to allow browser to clean up
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  private cleanup(): void {
    // Move video elements back to pool for reuse
    for (const video of this.videoElements.values()) {
      video.pause();
      video.currentTime = 0;
      // Don't clear src to avoid reloading
      this.videoPool.push(video);
    }
    this.videoElements.clear();
    
    // Clear frame cache
    this.frameCache.clear();
    this.preloadedFrames.clear();
    
    console.log('[Optimized Renderer] Cleanup completed, video elements pooled for reuse');
  }
  
  // Method to get current performance statistics
  getPerformanceStats() {
    return {
      videoElementsActive: this.videoElements.size,
      videoElementsPooled: this.videoPool.length,
      framesCached: this.frameCache.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }
  
  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage
    const frameSize = this.canvas.width * this.canvas.height * 4; // RGBA
    return this.frameCache.size * frameSize;
  }
}