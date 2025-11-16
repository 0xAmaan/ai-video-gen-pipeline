import type { Clip, MediaAssetMeta, Sequence } from "../types";

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
    }
  }

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
