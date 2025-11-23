/**
 * FrameRenderer
 *
 * Renders composite video frames to canvas from a sequence.
 * Handles single-clip rendering, transitions, and effects.
 */

import type {
  Sequence,
  Clip,
  MediaAssetMeta,
  Effect,
  TransitionSpec,
} from "../types";
import type {
  FrameRendererConfig,
  VideoFrame as PlayerVideoFrame,
} from "./types";
import { VideoLoader } from "../playback/video-loader";
import { renderTransition } from "../transitions/renderer";
import { getEasingFunction, type TransitionType } from "../transitions/presets";

type AspectRatioCache = {
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
};

export class FrameRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private config: FrameRendererConfig;
  private videoLoaders: Map<string, VideoLoader> = new Map();
  private mediaAssets: Map<string, MediaAssetMeta> = new Map();
  private isDetaching: boolean = false;

  // Performance optimizations
  private aspectRatioCache: Map<string, AspectRatioCache> = new Map();
  private transitionCanvasFrom: HTMLCanvasElement | null = null;
  private transitionCanvasTo: HTMLCanvasElement | null = null;
  private transitionCtxFrom: CanvasRenderingContext2D | null = null;
  private transitionCtxTo: CanvasRenderingContext2D | null = null;

  constructor(config: FrameRendererConfig) {
    this.config = {
      enableCache: true,
      maxCacheSize: 150, // Increased from 48/200 for better 60fps coverage
      useWebGL: false,
      ...config,
    };
  }

  /**
   * Attach renderer to a canvas element
   */
  async attach(canvas: HTMLCanvasElement): Promise<void> {
    this.isDetaching = false; // Reset detaching flag on attach
    this.canvas = canvas;

    // Get 2D context (WebGL support can be added later)
    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true, // Hint for better performance
    });

    if (!ctx) {
      throw new Error("Failed to get 2D rendering context");
    }

    this.ctx = ctx;

    // Set canvas size
    canvas.width = this.config.width;
    canvas.height = this.config.height;

    // Initialize persistent transition canvases
    this.initTransitionCanvases();
  }

  /**
   * Detach renderer and cleanup resources
   */
  detach(): void {
    // Set flag FIRST to stop any in-flight render operations
    this.isDetaching = true;

    // Dispose all video loaders
    for (const loader of this.videoLoaders.values()) {
      loader.dispose();
    }
    this.videoLoaders.clear();
    this.mediaAssets.clear();

    // Clear caches
    this.aspectRatioCache.clear();

    // Clean up transition canvases
    this.transitionCanvasFrom = null;
    this.transitionCanvasTo = null;
    this.transitionCtxFrom = null;
    this.transitionCtxTo = null;

    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Register media assets for the sequence
   */
  setMediaAssets(assets: Record<string, MediaAssetMeta>): void {
    this.mediaAssets = new Map(Object.entries(assets));
  }

  /**
   * Render a frame at the specified time
   */
  async renderFrame(sequence: Sequence, time: number): Promise<void> {
    if (!this.canvas || !this.ctx) {
      console.error("[FrameRenderer] Canvas or context not available!");
      throw new Error("Renderer not attached to canvas");
    }

    // Find active clips at current time
    const activeClips = this.findActiveClips(sequence, time);

    if (activeClips.length === 0) {
      // Clear canvas only when no clips to render
      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    // Check for transitions in video track
    const videoTrack = sequence.tracks.find((t) => t.kind === "video");
    if (videoTrack) {
      const transitionResult = this.findTransition(videoTrack, time);
      if (transitionResult) {
        // Render transition between two clips (will clear internally)
        await this.renderTransitionBetweenClips(
          transitionResult.fromClip,
          transitionResult.toClip,
          transitionResult.fromLocalTime,
          transitionResult.toLocalTime,
          transitionResult.transition,
          transitionResult.progress,
        );
        return;
      }
    }

    // No transition - render each active clip normally (layered by track order)
    // Only clear canvas if we successfully get frames
    let hasFrames = false;
    for (const { clip, localTime } of activeClips) {
      const rendered = await this.renderClip(clip, localTime);
      if (rendered) {
        hasFrames = true;
      }
    }

    // If no frames were rendered, clear to black
    if (!hasFrames && this.ctx && this.canvas) {
      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Find all clips that should be visible at the given time
   * Returns clips with their local playback time
   */
  private findActiveClips(
    sequence: Sequence,
    time: number,
  ): Array<{ clip: Clip; localTime: number }> {
    const result: Array<{ clip: Clip; localTime: number }> = [];

    // Process tracks in order (video tracks first, then overlays)
    const sortedTracks = [...sequence.tracks].sort((a, b) => {
      const order = { video: 0, overlay: 1, fx: 2, audio: 3 };
      return order[a.kind] - order[b.kind];
    });

    for (const track of sortedTracks) {
      if (track.kind === "audio") continue; // Skip audio tracks (handled separately)

      for (const clip of track.clips) {
        const clipStart = clip.start;
        const clipEnd = clip.start + clip.duration;

        // Check if time falls within this clip
        if (time >= clipStart && time < clipEnd) {
          // Calculate local time within the clip (accounting for trim)
          const timeInClip = time - clipStart;
          const localTime = clip.trimStart + timeInClip;

          result.push({ clip, localTime });
        }
      }
    }

    return result;
  }

  /**
   * Render a single clip to the canvas
   * Returns true if frame was successfully rendered, false otherwise
   */
  private async renderClip(clip: Clip, localTime: number): Promise<boolean> {
    if (this.isDetaching || !this.ctx || !this.canvas) return false;

    // Get or create video loader for this clip's media
    const loader = await this.getVideoLoader(clip.mediaId);
    if (this.isDetaching || !loader) {
      return false;
    }

    // Load the frame at the specified local time
    const frame = await loader.getFrameAt(localTime);
    if (this.isDetaching || !frame) {
      return false;
    }

    try {
      // Apply effects before drawing
      this.applyEffects(clip.effects, clip.opacity);

      // Guard check before drawing (context can be lost during async operations)
      if (this.isDetaching || !this.ctx || !this.canvas) {
        return false;
      }

      // Get cached aspect ratio calculations or compute new ones
      const dimensions = this.getAspectRatioDimensions(
        clip.mediaId,
        frame.displayWidth,
        frame.displayHeight,
      );

      // Draw frame to canvas with proper aspect ratio
      this.ctx.drawImage(
        frame,
        dimensions.offsetX,
        dimensions.offsetY,
        dimensions.drawWidth,
        dimensions.drawHeight,
      );

      // Reset effects
      this.resetEffects();
      return true; // Successfully rendered
    } finally {
      // Close the frame to free memory
      frame.close();
    }
  }

  /**
   * Apply effects to canvas context
   */
  private applyEffects(effects: Effect[], opacity: number): void {
    if (!this.ctx) return;

    // Apply opacity
    this.ctx.globalAlpha = opacity;

    // Build CSS filter string from effects
    const filters: string[] = [];

    for (const effect of effects) {
      if (!effect.enabled) continue;

      switch (effect.type) {
        case "brightness":
          {
            const value = effect.params.brightness ?? 1.0;
            filters.push(`brightness(${value})`);
          }
          break;

        case "contrast":
          {
            const value = effect.params.contrast ?? 1.0;
            filters.push(`contrast(${value})`);
          }
          break;

        case "saturation":
          {
            const value = effect.params.saturation ?? 1.0;
            filters.push(`saturate(${value})`);
          }
          break;

        case "blur":
          {
            const value = effect.params.blur ?? 0;
            if (value > 0) {
              filters.push(`blur(${value}px)`);
            }
          }
          break;

        // More effects can be added here
      }
    }

    if (filters.length > 0) {
      this.ctx.filter = filters.join(" ");
    }
  }

  /**
   * Reset canvas effects to default
   */
  private resetEffects(): void {
    if (!this.ctx) return;
    this.ctx.globalAlpha = 1.0;
    this.ctx.filter = "none";
  }

  /**
   * Find if a transition is active at the given time
   */
  private findTransition(
    track: { clips: Clip[] },
    time: number,
  ): {
    fromClip: Clip;
    toClip: Clip;
    fromLocalTime: number;
    toLocalTime: number;
    transition: TransitionSpec;
    progress: number;
  } | null {
    // Sort clips by start time
    const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sortedClips.length - 1; i++) {
      const fromClip = sortedClips[i];
      const toClip = sortedClips[i + 1];

      // Check if toClip has a transition
      if (toClip.transitions.length === 0) continue;

      const transition = toClip.transitions[0]; // Use first transition
      const transitionStart = toClip.start;
      const transitionEnd = toClip.start + transition.duration;

      // Check if time falls within transition
      if (time >= transitionStart && time < transitionEnd) {
        // Calculate progress through transition
        const rawProgress = (time - transitionStart) / transition.duration;

        // Apply easing function
        const easingFn = getEasingFunction(transition.easing);
        const progress = easingFn(Math.max(0, Math.min(1, rawProgress)));

        // Calculate local times for both clips
        const fromLocalTime =
          fromClip.trimStart + (transitionStart - fromClip.start);
        const toLocalTime = toClip.trimStart + (time - toClip.start);

        return {
          fromClip,
          toClip,
          fromLocalTime,
          toLocalTime,
          transition,
          progress,
        };
      }
    }

    return null;
  }

  /**
   * Render a transition between two clips
   */
  private async renderTransitionBetweenClips(
    fromClip: Clip,
    toClip: Clip,
    fromLocalTime: number,
    toLocalTime: number,
    transition: TransitionSpec,
    progress: number,
  ): Promise<void> {
    if (
      !this.ctx ||
      !this.canvas ||
      !this.transitionCanvasFrom ||
      !this.transitionCanvasTo ||
      !this.transitionCtxFrom ||
      !this.transitionCtxTo
    )
      return;

    // Load frames from both clips
    const fromLoader = await this.getVideoLoader(fromClip.mediaId);
    const toLoader = await this.getVideoLoader(toClip.mediaId);

    if (!fromLoader || !toLoader) {
      console.warn("Missing loader for transition");
      return;
    }

    const fromFrame = await fromLoader.getFrameAt(fromLocalTime);
    const toFrame = await toLoader.getFrameAt(toLocalTime);

    if (!fromFrame || !toFrame) {
      console.warn("Missing frame for transition");
      fromFrame?.close();
      toFrame?.close();
      return;
    }

    try {
      // Render frames to persistent canvases with proper aspect ratio
      this.renderFrameToCanvas(
        fromFrame,
        fromClip.mediaId,
        this.transitionCanvasFrom,
        this.transitionCtxFrom,
      );
      this.renderFrameToCanvas(
        toFrame,
        toClip.mediaId,
        this.transitionCanvasTo,
        this.transitionCtxTo,
      );

      // Render the transition using the transition renderer
      renderTransition(transition.type as TransitionType, {
        ctx: this.ctx,
        width: this.canvas.width,
        height: this.canvas.height,
        fromFrame: this.transitionCanvasFrom,
        toFrame: this.transitionCanvasTo,
        progress,
      });
    } finally {
      // Clean up frames
      fromFrame.close();
      toFrame.close();
    }
  }

  /**
   * Initialize persistent transition canvases
   */
  private initTransitionCanvases(): void {
    if (!this.canvas) return;

    // Create persistent canvases for transitions
    this.transitionCanvasFrom = document.createElement("canvas");
    this.transitionCanvasFrom.width = this.canvas.width;
    this.transitionCanvasFrom.height = this.canvas.height;
    this.transitionCtxFrom = this.transitionCanvasFrom.getContext("2d");

    this.transitionCanvasTo = document.createElement("canvas");
    this.transitionCanvasTo.width = this.canvas.width;
    this.transitionCanvasTo.height = this.canvas.height;
    this.transitionCtxTo = this.transitionCanvasTo.getContext("2d");

    if (!this.transitionCtxFrom || !this.transitionCtxTo) {
      throw new Error("Failed to create transition canvas contexts");
    }
  }

  /**
   * Get or calculate aspect ratio dimensions for a media asset
   */
  private getAspectRatioDimensions(
    mediaId: string,
    frameWidth: number,
    frameHeight: number,
  ): AspectRatioCache {
    if (!this.canvas) {
      throw new Error("Canvas not available");
    }

    // Check cache first
    const cached = this.aspectRatioCache.get(mediaId);
    if (cached) {
      return cached;
    }

    // Calculate aspect ratios
    const videoAspect = frameWidth / frameHeight;
    const canvasAspect = this.canvas.width / this.canvas.height;

    let drawWidth: number;
    let drawHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    // Fit video to canvas while preserving aspect ratio
    if (videoAspect > canvasAspect) {
      // Video is wider than canvas - fit to width
      drawWidth = this.canvas.width;
      drawHeight = this.canvas.width / videoAspect;
      offsetY = (this.canvas.height - drawHeight) / 2;
    } else {
      // Video is taller than canvas - fit to height
      drawHeight = this.canvas.height;
      drawWidth = this.canvas.height * videoAspect;
      offsetX = (this.canvas.width - drawWidth) / 2;
    }

    const dimensions: AspectRatioCache = {
      drawWidth,
      drawHeight,
      offsetX,
      offsetY,
    };

    // Cache for future use
    this.aspectRatioCache.set(mediaId, dimensions);

    return dimensions;
  }

  /**
   * Render a frame to a specific canvas with proper aspect ratio
   */
  private renderFrameToCanvas(
    frame: VideoFrame,
    mediaId: string,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
  ): void {
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get cached dimensions
    const dimensions = this.getAspectRatioDimensions(
      mediaId,
      frame.displayWidth,
      frame.displayHeight,
    );

    // Draw frame with proper aspect ratio
    ctx.drawImage(
      frame as CanvasImageSource,
      dimensions.offsetX,
      dimensions.offsetY,
      dimensions.drawWidth,
      dimensions.drawHeight,
    );
  }

  /**
   * Get or create a VideoLoader for the specified media asset
   */
  private async getVideoLoader(mediaId: string): Promise<VideoLoader | null> {
    // Check if loader already exists
    if (this.videoLoaders.has(mediaId)) {
      return this.videoLoaders.get(mediaId)!;
    }

    // Get media asset
    const asset = this.mediaAssets.get(mediaId);
    if (!asset) {
      console.error(`Media asset not found: ${mediaId}`);
      return null;
    }

    // Create new loader
    const loader = new VideoLoader(asset, {
      cacheSize: this.config.maxCacheSize,
      lookaheadSeconds: 3.0, // Increased from 2.0s for better buffering
    });

    await loader.init();
    this.videoLoaders.set(mediaId, loader);

    return loader;
  }

  /**
   * Set playback mode for all video loaders
   * Disables cache trimming during playback to prevent flickering
   */
  setPlaybackMode(isPlaying: boolean): void {
    for (const loader of this.videoLoaders.values()) {
      loader.setPlaybackMode(isPlaying);
    }
  }
}
