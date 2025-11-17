import type { Clip, MediaAssetMeta, Sequence } from "../types";
import { renderTransition } from "../transitions/renderer";
import type { TransitionType } from "../transitions/presets";
import { getEasingFunction } from "../transitions/presets";
import { applyClipEffects } from "../effects";

export type FrameCallback = (frameData: ImageData, timestamp: number) => void;

export class FrameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoElements = new Map<string, HTMLVideoElement>();

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    this.ctx = ctx;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  async renderSequence(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
    fps: number,
    onFrame: FrameCallback,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    this.currentSequence = sequence;
    const frameDuration = 1 / fps;
    const totalFrames = Math.ceil(sequence.duration * fps);

    // Preload all video elements
    await this.preloadVideos(sequence, assets);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const timestamp = frameIndex * frameDuration;

      // Find clip at this timestamp
      const clip = this.resolveClip(sequence, timestamp);

      // Draw frame
      await this.drawFrame(clip, timestamp, assets);

      // Capture frame data
      const imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
      onFrame(imageData, timestamp);

      // Report progress
      if (onProgress) {
        const progress = ((frameIndex + 1) / totalFrames) * 100;
        onProgress(progress);
      }
    }

    this.cleanup();
  }

  private async preloadVideos(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
  ): Promise<void> {
    const uniqueMediaIds = new Set<string>();

    for (const track of sequence.tracks) {
      for (const clip of track.clips) {
        uniqueMediaIds.add(clip.mediaId);
      }
    }

    const loadPromises: Promise<void>[] = [];

    for (const mediaId of uniqueMediaIds) {
      const asset = assets[mediaId];
      if (!asset || asset.type !== "video") continue;

      const video = document.createElement("video");
      video.src = asset.url;
      video.crossOrigin = "anonymous";
      video.playsInline = true;
      video.muted = true;

      const loadPromise = new Promise<void>((resolve, reject) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        video.addEventListener(
          "error",
          () => reject(new Error(`Failed to load video: ${asset.name}`)),
          { once: true },
        );
      });

      loadPromises.push(loadPromise);
      this.videoElements.set(mediaId, video);
    }

    await Promise.all(loadPromises);
  }

  private async drawFrame(
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

    // Check for transitions
    const transitionInfo = this.getTransitionInfo(clip, timestamp);

    if (transitionInfo) {
      // Render transition between current and next clip
      await this.drawTransitionFrame(
        clip,
        transitionInfo.nextClip,
        transitionInfo.progress,
        transitionInfo.type,
        timestamp,
      );
    } else {
      // Regular single-clip frame
      await this.drawSingleClipFrame(clip, timestamp);
    }
  }

  private async drawSingleClipFrame(
    clip: Clip,
    timestamp: number,
  ): Promise<void> {
    const video = this.videoElements.get(clip.mediaId);
    if (!video) return;

    // Seek video to correct position within clip
    const playheadWithinClip = timestamp - clip.start + clip.trimStart;

    // Seek and wait for seek to complete
    if (Math.abs(video.currentTime - playheadWithinClip) > 0.001) {
      video.currentTime = playheadWithinClip;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);

        // Timeout in case seeked doesn't fire
        setTimeout(resolve, 100);
      });
    }

    // Draw with aspect ratio preservation (same as PreviewRenderer)
    if (video.videoWidth > 0 && video.videoHeight > 0) {
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

      this.ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

      // Apply clip effects if present
      if (clip.effects && clip.effects.length > 0) {
        // Use frame number based on timestamp for temporal consistency
        const frameNumber = Math.floor(timestamp * 30); // Assume 30fps for seed
        applyClipEffects(this.ctx, clip, frameNumber);
      }
    }
  }

  private async drawTransitionFrame(
    currentClip: Clip,
    nextClip: Clip,
    progress: number,
    transitionType: string,
    timestamp: number,
  ): Promise<void> {
    const currentVideo = this.videoElements.get(currentClip.mediaId);
    const nextVideo = this.videoElements.get(nextClip.mediaId);

    if (!currentVideo || !nextVideo) {
      // Fallback to single clip
      await this.drawSingleClipFrame(currentClip, timestamp);
      return;
    }

    // Seek both videos
    const currentTime = timestamp - currentClip.start + currentClip.trimStart;
    const nextTime = timestamp - nextClip.start + nextClip.trimStart;

    await Promise.all([
      this.seekVideo(currentVideo, currentTime),
      this.seekVideo(nextVideo, Math.max(nextClip.trimStart, nextTime)),
    ]);

    // Create temporary canvases for applying effects before transition
    const fromCanvas = document.createElement('canvas');
    fromCanvas.width = this.canvas.width;
    fromCanvas.height = this.canvas.height;
    const fromCtx = fromCanvas.getContext('2d');

    const toCanvas = document.createElement('canvas');
    toCanvas.width = this.canvas.width;
    toCanvas.height = this.canvas.height;
    const toCtx = toCanvas.getContext('2d');

    if (!fromCtx || !toCtx) {
      // Fallback if context creation fails
      renderTransition(transitionType as TransitionType, {
        ctx: this.ctx,
        width: this.canvas.width,
        height: this.canvas.height,
        fromFrame: currentVideo,
        toFrame: nextVideo,
        progress,
      });
      return;
    }

    // Draw current clip to fromCanvas with aspect ratio
    this.drawVideoWithAspectRatio(fromCtx, currentVideo, this.canvas.width, this.canvas.height);

    // Apply effects to current clip if present
    if (currentClip.effects && currentClip.effects.length > 0) {
      const frameNumber = Math.floor(timestamp * 30);
      applyClipEffects(fromCtx, currentClip, frameNumber);
    }

    // Draw next clip to toCanvas with aspect ratio
    this.drawVideoWithAspectRatio(toCtx, nextVideo, this.canvas.width, this.canvas.height);

    // Apply effects to next clip if present
    if (nextClip.effects && nextClip.effects.length > 0) {
      const frameNumber = Math.floor(timestamp * 30);
      applyClipEffects(toCtx, nextClip, frameNumber);
    }

    // Use transition renderer with effect-applied canvases
    renderTransition(transitionType as TransitionType, {
      ctx: this.ctx,
      width: this.canvas.width,
      height: this.canvas.height,
      fromFrame: fromCanvas,
      toFrame: toCanvas,
      progress,
    });
  }

  /**
   * Helper to draw video with aspect ratio preservation (letterbox/pillarbox)
   */
  private drawVideoWithAspectRatio(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return; // Video not ready
    }

    // Fill with black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth: number;
    let drawHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspect > canvasAspect) {
      // Video is wider - fit to width, letterbox top/bottom
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / videoAspect;
      offsetY = (canvasHeight - drawHeight) / 2;
    } else {
      // Video is taller - fit to height, pillarbox left/right
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * videoAspect;
      offsetX = (canvasWidth - drawWidth) / 2;
    }

    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
  }

  private async seekVideo(
    video: HTMLVideoElement,
    targetTime: number,
  ): Promise<void> {
    if (Math.abs(video.currentTime - targetTime) > 0.001) {
      video.currentTime = targetTime;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        setTimeout(resolve, 100);
      });
    }
  }

  private getTransitionInfo(
    clip: Clip,
    timestamp: number,
  ): { nextClip: Clip; progress: number; type: string } | null {
    if (!clip.transitions || clip.transitions.length === 0) return null;

    const transition = clip.transitions[0];
    const clipEnd = clip.start + clip.duration;
    const transitionStart = clipEnd - transition.duration;

    if (timestamp >= transitionStart && timestamp <= clipEnd) {
      // Find next clip
      const sequence = this.currentSequence;
      if (!sequence) return null;

      const videoTrack = sequence.tracks.find((t) => t.kind === "video");
      if (!videoTrack) return null;

      const clipIndex = videoTrack.clips.findIndex((c) => c.id === clip.id);
      if (clipIndex < 0 || clipIndex >= videoTrack.clips.length - 1) return null;

      const nextClip = videoTrack.clips[clipIndex + 1];
      const elapsed = timestamp - transitionStart;
      const rawProgress = elapsed / transition.duration;

      // Apply easing function (reconstruct from string identifier)
      const easingFn = getEasingFunction(transition.easing);
      const progress = easingFn(rawProgress);

      return {
        nextClip,
        progress: Math.max(0, Math.min(1, progress)),
        type: transition.type,
      };
    }

    return null;
  }

  private currentSequence?: Sequence;

  private resolveClip(sequence: Sequence, time: number): Clip | undefined {
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

  private cleanup(): void {
    for (const video of this.videoElements.values()) {
      video.src = "";
      video.load();
    }
    this.videoElements.clear();
  }
}
