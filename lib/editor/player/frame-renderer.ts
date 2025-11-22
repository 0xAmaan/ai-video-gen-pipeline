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

export class FrameRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private config: FrameRendererConfig;
  private videoLoaders: Map<string, VideoLoader> = new Map();
  private mediaAssets: Map<string, MediaAssetMeta> = new Map();

  constructor(config: FrameRendererConfig) {
    this.config = {
      enableCache: true,
      maxCacheSize: 200,
      useWebGL: false,
      ...config,
    };
  }

  /**
   * Attach renderer to a canvas element
   */
  async attach(canvas: HTMLCanvasElement): Promise<void> {
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
  }

  /**
   * Detach renderer and cleanup resources
   */
  detach(): void {
    // Dispose all video loaders
    for (const loader of this.videoLoaders.values()) {
      loader.dispose();
    }
    this.videoLoaders.clear();
    this.mediaAssets.clear();

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
    console.log(
      `[FrameRenderer] renderFrame called at time ${time.toFixed(3)}s`,
    );

    if (!this.canvas || !this.ctx) {
      console.error("[FrameRenderer] Canvas or context not available!");
      throw new Error("Renderer not attached to canvas");
    }

    console.log(
      `[FrameRenderer] Canvas size: ${this.canvas.width}x${this.canvas.height}`,
    );

    // Clear canvas
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Find active clips at current time
    const activeClips = this.findActiveClips(sequence, time);

    console.log(
      `[FrameRenderer] Found ${activeClips.length} active clips at time ${time.toFixed(3)}s`,
    );

    if (activeClips.length === 0) {
      // No clips to render - canvas stays black
      console.warn(
        "[FrameRenderer] No active clips found - showing black screen",
      );
      return;
    }

    // Check for transitions in video track
    const videoTrack = sequence.tracks.find((t) => t.kind === "video");
    if (videoTrack) {
      const transitionResult = this.findTransition(videoTrack, time);
      if (transitionResult) {
        // Render transition between two clips
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
    for (const { clip, localTime } of activeClips) {
      await this.renderClip(clip, localTime);
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
   */
  private async renderClip(clip: Clip, localTime: number): Promise<void> {
    if (!this.ctx || !this.canvas) return;

    console.log(
      `[FrameRenderer] renderClip - clip ${clip.id}, localTime ${localTime.toFixed(3)}s`,
    );

    // Get or create video loader for this clip's media
    const loader = await this.getVideoLoader(clip.mediaId);
    if (!loader) {
      console.warn(`[FrameRenderer] No loader found for media ${clip.mediaId}`);
      return;
    }

    // Load the frame at the specified local time
    const frame = await loader.getFrameAt(localTime);
    if (!frame) {
      console.warn(
        `[FrameRenderer] No frame available at ${localTime.toFixed(3)}s for clip ${clip.id}`,
      );
      return;
    }

    console.log(`[FrameRenderer] Got frame, drawing to canvas`);

    try {
      // Apply effects before drawing
      this.applyEffects(clip.effects, clip.opacity);

      // Draw frame to canvas
      this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);

      // Reset effects
      this.resetEffects();
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
    if (!this.ctx || !this.canvas) return;

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
      // Render the transition using the transition renderer
      renderTransition(transition.type as TransitionType, {
        ctx: this.ctx,
        width: this.canvas.width,
        height: this.canvas.height,
        fromFrame,
        toFrame,
        progress,
      });
    } finally {
      // Clean up frames
      fromFrame.close();
      toFrame.close();
    }
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
      lookaheadSeconds: 2.0,
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
