import type { Clip, MediaAssetMeta, Sequence } from "../types";
import { FrameCache } from "./frame-cache";

export type TimeUpdateHandler = (time: number) => void;

export class PreviewRenderer {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private videoEl?: HTMLVideoElement;
  private currentClip?: Clip;
  private raf?: number;
  private playing = false;
  private currentTime = 0;
  private readonly cache = new FrameCache();
  private audioContext?: AudioContext;
  private workletNode?: AudioWorkletNode;
  private onTimeUpdate?: TimeUpdateHandler;
  private lastFrameTime?: number;
  private pendingSeek?: number;
  private seekDebounceTimer?: number;
  private isDrawingFrame = false;
  private isScrubbing = false;
  private wasPlayingBeforeScrub = false;

  // Performance metrics
  private frameCount = 0;
  private lastFpsTime = 0;
  private currentFps = 0;
  private frameRenderTime = 0;

  constructor(
    private readonly getSequence: () => Sequence | null,
    private readonly getAsset: (id: string) => MediaAssetMeta | undefined,
  ) {}

  async attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.videoEl) {
      await this.createMediaElements();
    }
  }

  private async createMediaElements() {
    this.videoEl = document.createElement("video");
    this.videoEl.crossOrigin = "anonymous";
    this.videoEl.playsInline = true;
    this.videoEl.preload = "metadata";
    this.videoEl.muted = true;
    this.videoEl.addEventListener("ended", () => this.handleClipEnded());
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.audioWorklet.addModule(
        "/audio/preview-processor.js",
      );
      const source = this.audioContext.createMediaElementSource(this.videoEl);
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        "preview-processor",
      );
      source.connect(this.workletNode).connect(this.audioContext.destination);
    } catch (error) {
      // Silently handle audio worklet init errors
    }
  }

  setTimeUpdateHandler(handler: TimeUpdateHandler) {
    this.onTimeUpdate = handler;
  }

  getPerformanceMetrics() {
    return {
      fps: this.currentFps,
      frameTime: this.frameRenderTime,
      isPlaying: this.playing,
    };
  }

  async play() {
    this.playing = true;
    this.lastFrameTime = undefined; // Reset timing on play
    await this.audioContext?.resume();
    await this.videoEl?.play().catch(() => undefined);
    this.loop();
  }

  pause() {
    this.playing = false;
    this.videoEl?.pause();
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = undefined;
    }
    this.lastFrameTime = undefined;
  }

  seek(time: number) {
    this.currentTime = time;

    // Debounce video element seeks to prevent thrashing
    if (this.seekDebounceTimer !== undefined) {
      clearTimeout(this.seekDebounceTimer);
    }

    this.seekDebounceTimer = window.setTimeout(() => {
      this.syncMediaToTimeline();
      this.seekDebounceTimer = undefined;
    }, 16); // ~60fps debounce

    this.drawFrame();
  }

  startScrubbing() {
    if (this.isScrubbing) return;
    this.isScrubbing = true;
    this.wasPlayingBeforeScrub = this.playing;
    if (this.playing) {
      this.pause();
    }
  }

  endScrubbing() {
    if (!this.isScrubbing) return;
    this.isScrubbing = false;
    if (this.wasPlayingBeforeScrub) {
      this.play();
    }
  }

  detach() {
    this.pause();
    this.cache.clear();
    this.videoEl?.pause();
    this.videoEl?.removeAttribute("src");
    this.videoEl?.load();
    this.workletNode?.disconnect();
    this.audioContext?.close();
  }

  private loop = (timestamp?: number) => {
    if (!this.playing) return;
    this.render(timestamp);
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(timestamp?: number) {
    if (!this.canvas || !this.ctx) return;

    const renderStart = performance.now();

    // Use timestamp-based timing instead of fixed increments
    if (timestamp !== undefined) {
      if (this.lastFrameTime !== undefined) {
        const deltaMs = timestamp - this.lastFrameTime;
        const deltaSec = deltaMs / 1000;
        this.currentTime += deltaSec;
      }
      this.lastFrameTime = timestamp;
    } else {
      // Fallback if no timestamp provided
      this.currentTime += 1 / 60;
    }

    this.syncMediaToTimeline();
    this.drawFrame();
    this.onTimeUpdate?.(this.currentTime);

    // Track performance metrics
    const renderEnd = performance.now();
    this.frameRenderTime = renderEnd - renderStart;
    this.frameCount++;

    // Update FPS every second
    if (renderEnd >= this.lastFpsTime + 1000) {
      this.currentFps = Math.round(
        (this.frameCount * 1000) / (renderEnd - this.lastFpsTime),
      );
      this.frameCount = 0;
      this.lastFpsTime = renderEnd;
    }
  }

  private syncMediaToTimeline() {
    const sequence = this.getSequence();
    if (!sequence) return;
    const clip = this.resolveClip(sequence, this.currentTime);
    if (!clip) {
      this.currentClip = undefined;
      return;
    }
    if (!this.currentClip || this.currentClip.id !== clip.id) {
      this.currentClip = clip;
      const asset = this.getAsset(clip.mediaId);
      if (asset && this.videoEl && this.videoEl.src !== asset.url) {
        this.videoEl.src = asset.url;
        this.videoEl.currentTime = clip.trimStart;
      }
    }
    if (this.videoEl) {
      const playheadWithinClip = this.currentTime - clip.start + clip.trimStart;
      if (Math.abs(this.videoEl.currentTime - playheadWithinClip) > 0.05) {
        this.videoEl.currentTime = Math.max(clip.trimStart, playheadWithinClip);
      }
    }
  }

  private drawFrame() {
    if (!this.canvas || !this.ctx) return;

    // Render coalescing: skip if already drawing
    if (this.isDrawingFrame) return;
    this.isDrawingFrame = true;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const video = this.videoEl;

    // Only clear if we have no video to draw (prevents flicker)
    const hasVideo =
      video &&
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0;

    if (hasVideo) {
      // Calculate aspect ratios
      const videoAspect = video.videoWidth / video.videoHeight;
      const canvasAspect = canvasWidth / canvasHeight;

      let drawWidth: number;
      let drawHeight: number;
      let offsetX = 0;
      let offsetY = 0;

      // Fit video to canvas while preserving aspect ratio (letterbox/pillarbox)
      if (videoAspect > canvasAspect) {
        // Video is wider - fit to width, add letterbox (black bars top/bottom)
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / videoAspect;
        offsetY = (canvasHeight - drawHeight) / 2;

        // Clear letterbox bars ONLY (not entire canvas)
        this.ctx.fillStyle = "#050505";
        this.ctx.fillRect(0, 0, canvasWidth, offsetY); // Top bar
        this.ctx.fillRect(0, offsetY + drawHeight, canvasWidth, offsetY); // Bottom bar
      } else {
        // Video is taller - fit to height, add pillarbox (black bars left/right)
        drawHeight = canvasHeight;
        drawWidth = canvasHeight * videoAspect;
        offsetX = (canvasWidth - drawWidth) / 2;

        // Clear pillarbox bars ONLY (not entire canvas)
        this.ctx.fillStyle = "#050505";
        this.ctx.fillRect(0, 0, offsetX, canvasHeight); // Left bar
        this.ctx.fillRect(offsetX + drawWidth, 0, offsetX, canvasHeight); // Right bar
      }

      // Draw video centered with correct aspect ratio
      this.ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    } else {
      // No media fallback
      this.ctx.fillStyle = "#888";
      this.ctx.fillText("No media", 24, 32);
    }

    this.isDrawingFrame = false;
  }

  private resolveClip(sequence: Sequence, time: number) {
    for (const track of sequence.tracks) {
      for (const clip of track.clips) {
        if (time >= clip.start && time <= clip.start + clip.duration) {
          return clip;
        }
      }
    }
    return undefined;
  }

  private handleClipEnded() {
    const sequence = this.getSequence();
    if (!sequence || !this.currentClip) return;
    const end = this.currentClip.start + this.currentClip.duration;
    const next = this.resolveClip(sequence, end + 0.01);
    if (next) {
      this.currentTime = next.start;
      this.currentClip = next;
      this.syncMediaToTimeline();
    } else {
      this.pause();
    }
  }
}
