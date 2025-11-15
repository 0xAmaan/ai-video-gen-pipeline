import type { Clip, MediaAssetMeta, Sequence } from "../types";
import { FrameCache } from "./frame-cache";

export type TimeUpdateHandler = (time: number) => void;

export class PreviewRenderer {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private videoEl?: HTMLVideoElement;
  private currentClip?: Clip;
  private raf?: number;
  private playing = false;
  private currentTime = 0;
  private readonly cache = new FrameCache();
  private audioContext?: AudioContext;
  private workletNode?: AudioWorkletNode;
  private onTimeUpdate?: TimeUpdateHandler;

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
      await this.audioContext.audioWorklet.addModule("/audio/preview-processor.js");
      const source = this.audioContext.createMediaElementSource(this.videoEl);
      this.workletNode = new AudioWorkletNode(this.audioContext, "preview-processor");
      source.connect(this.workletNode).connect(this.audioContext.destination);
    } catch (error) {
      console.warn("PreviewRenderer: failed to init audio worklet", error);
    }
  }

  setTimeUpdateHandler(handler: TimeUpdateHandler) {
    this.onTimeUpdate = handler;
  }

  async play() {
    this.playing = true;
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
  }

  seek(time: number) {
    this.currentTime = time;
    this.syncMediaToTimeline();
    this.drawFrame();
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

  private loop = () => {
    if (!this.playing) return;
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private render() {
    if (!this.canvas || !this.ctx) return;
    this.currentTime += 1 / 60;
    this.syncMediaToTimeline();
    this.drawFrame();
    this.onTimeUpdate?.(this.currentTime);
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
    const width = this.canvas.width;
    const height = this.canvas.height;
    const video = this.videoEl;
    if (video && video.readyState >= 2) {
      this.ctx.drawImage(video, 0, 0, width, height);
      return;
    }
    this.ctx.fillStyle = "#050505";
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.fillStyle = "#888";
    this.ctx.fillText("No media", 24, 32);
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
