import type { Clip, MediaAssetMeta, Sequence, Track } from "../types";
import { FrameCache } from "./frame-cache";
import { renderTransition, type TransitionRenderContext } from "../transitions/renderer";
import type { TransitionType } from "../transitions/presets";
import { getEasingFunction } from "../transitions/presets";

export type TimeUpdateHandler = (time: number) => void;

const NARRATION_TRACK_ID = "audio-narration";
const BGM_TRACK_ID = "audio-bgm";

export class PreviewRenderer {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private videoEl?: HTMLVideoElement;
  private nextVideoEl?: HTMLVideoElement;
  private currentClip?: Clip;
  private nextClip?: Clip;
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
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private audioSources: Map<string, AudioBufferSourceNode> = new Map();
  private audioGainNode?: GainNode;
  private audioLoadPromises: Map<string, Promise<void>> = new Map();
  private masterVolume = 1;

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

  async preloadAudioAssets(assets: Record<string, MediaAssetMeta>) {
    if (!this.audioContext) {
      await this.createMediaElements();
    }
    const audioAssets = Object.values(assets).filter(
      (asset) => asset.type === "audio" && !!asset.url,
    );

    await Promise.all(
      audioAssets.map(async (asset) => {
        if (!asset.url || this.audioBuffers.has(asset.id)) {
          return;
        }
        if (this.audioLoadPromises.has(asset.id)) {
          await this.audioLoadPromises.get(asset.id);
          return;
        }

        const loadPromise = (async () => {
          try {
            const response = await fetch(asset.url, {
              mode: "cors",
              credentials: "omit",
            });
            const arrayBuffer = await response.arrayBuffer();
            if (!this.audioContext) return;
            const audioBuffer = await this.audioContext.decodeAudioData(
              arrayBuffer,
            );
            this.audioBuffers.set(asset.id, audioBuffer);
          } catch (error) {
            console.error(`Failed to load audio asset ${asset.id}`, error);
          }
        })();

        this.audioLoadPromises.set(asset.id, loadPromise);
        await loadPromise;
        this.audioLoadPromises.delete(asset.id);
      }),
    );
  }

  private async createMediaElements() {
    this.videoEl = document.createElement("video");
    this.videoEl.crossOrigin = "anonymous";
    this.videoEl.playsInline = true;
    this.videoEl.preload = "metadata";
    this.videoEl.muted = true;
    this.videoEl.addEventListener("ended", () => this.handleClipEnded());

    // Create second video element for transition blending
    this.nextVideoEl = document.createElement("video");
    this.nextVideoEl.crossOrigin = "anonymous";
    this.nextVideoEl.playsInline = true;
    this.nextVideoEl.preload = "metadata";
    this.nextVideoEl.muted = true;
    try {
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      this.audioGainNode = this.audioContext.createGain();
      this.audioGainNode.gain.value = this.masterVolume;
      this.audioGainNode.connect(this.audioContext.destination);
      await this.audioContext.audioWorklet.addModule(
        "/audio/preview-processor.js",
      );
      const source = this.audioContext.createMediaElementSource(this.videoEl);
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        "preview-processor",
      );
      source.connect(this.workletNode).connect(this.audioGainNode);
    } catch (error) {
      // Silently handle audio worklet init errors
    }
  }

  setTimeUpdateHandler(handler: TimeUpdateHandler) {
    this.onTimeUpdate = handler;
  }

  setMasterVolume(value: number) {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this.audioGainNode) {
      this.audioGainNode.gain.value = this.masterVolume;
    }
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
    this.syncAudioToTimeline();
    this.loop();
  }

  pause() {
    this.playing = false;
    this.videoEl?.pause();
    this.stopAllAudioSources();
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

    this.stopAllAudioSources();

    this.seekDebounceTimer = window.setTimeout(() => {
      this.syncMediaToTimeline();
      if (this.playing) {
        this.syncAudioToTimeline();
      }
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
    this.audioBuffers.clear();
    this.audioLoadPromises.clear();
    this.videoEl?.pause();
    this.videoEl?.removeAttribute("src");
    this.videoEl?.load();
    this.workletNode?.disconnect();
    this.audioGainNode?.disconnect();
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
    if (this.playing) {
      this.syncAudioToTimeline();
    }
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

  private stopAllAudioSources() {
    for (const [, source] of this.audioSources.entries()) {
      try {
        source.stop();
      } catch {
        // Source may already be stopped – safe to ignore
      }
      source.disconnect();
    }
    this.audioSources.clear();
  }

  private syncMediaToTimeline() {
    const sequence = this.getSequence();
    if (!sequence) return;
    const clip = this.resolveClip(sequence, this.currentTime);
    if (!clip) {
      this.currentClip = undefined;
      this.nextClip = undefined;
      return;
    }
    if (!this.currentClip || this.currentClip.id !== clip.id) {
      this.currentClip = clip;
      const asset = this.getAsset(clip.mediaId);
      if (asset && this.videoEl && this.videoEl.src !== asset.url) {
        this.videoEl.src = asset.url;
        this.videoEl.currentTime = clip.trimStart;
      }

      // Load next clip for transitions
      const videoTrack = sequence.tracks.find((t) => t.kind === "video");
      if (videoTrack) {
        const clipIndex = videoTrack.clips.findIndex((c) => c.id === clip.id);
        if (clipIndex >= 0 && clipIndex < videoTrack.clips.length - 1) {
          this.nextClip = videoTrack.clips[clipIndex + 1];
          const nextAsset = this.getAsset(this.nextClip.mediaId);
          if (nextAsset && this.nextVideoEl && this.nextVideoEl.src !== nextAsset.url) {
            this.nextVideoEl.src = nextAsset.url;
            // Force preload to ensure video is ready for transitions
            this.nextVideoEl.preload = 'auto';
            // Wait for metadata before seeking
            if (this.nextVideoEl.readyState === 0) {
              this.nextVideoEl.addEventListener('loadedmetadata', () => {
                if (this.nextVideoEl && this.nextClip) {
                  this.nextVideoEl.currentTime = this.nextClip.trimStart;
                }
              }, { once: true });
              this.nextVideoEl.load();
            } else {
              this.nextVideoEl.currentTime = this.nextClip.trimStart;
            }
          }
        } else {
          this.nextClip = undefined;
        }
      }
    }
    if (this.videoEl) {
      const playheadWithinClip = this.currentTime - clip.start + clip.trimStart;
      if (Math.abs(this.videoEl.currentTime - playheadWithinClip) > 0.05) {
        this.videoEl.currentTime = Math.max(clip.trimStart, playheadWithinClip);
      }
    }

    // Sync next video if we're near transition
    if (this.nextClip && this.nextVideoEl && clip.transitions && clip.transitions.length > 0) {
      const transition = clip.transitions[0];
      const clipEnd = clip.start + clip.duration;
      const transitionStart = clipEnd - transition.duration;

      if (this.currentTime >= transitionStart) {
        const nextClipTime = this.currentTime - clipEnd + this.nextClip.trimStart;
        if (Math.abs(this.nextVideoEl.currentTime - nextClipTime) > 0.05) {
          this.nextVideoEl.currentTime = Math.max(this.nextClip.trimStart, nextClipTime);
        }
      }
    }
  }

  private drawFrame() {
    if (!this.canvas || !this.ctx) return;

    // Safety check: ensure canvas has valid dimensions
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      console.warn('[PreviewRenderer] Canvas has invalid dimensions, skipping draw');
      return;
    }

    // Render coalescing: skip if already drawing
    if (this.isDrawingFrame) return;
    this.isDrawingFrame = true;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const video = this.videoEl;

    // Check if we're in a transition
    const transitionInfo = this.getActiveTransition();

    // Only clear if we have no video to draw (prevents flicker)
    const hasVideo =
      video &&
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0;

    if (hasVideo && transitionInfo && this.nextVideoEl) {
      // Render transition between current and next clip
      // Note: readyState >= 1 (HAVE_METADATA) is sufficient - we just need dimensions
      const hasNextVideo =
        this.nextVideoEl.readyState >= 1 &&
        this.nextVideoEl.videoWidth > 0 &&
        this.nextVideoEl.videoHeight > 0;

      if (hasNextVideo) {
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Create temporary canvases for aspect-ratio-corrected frames
        const fromCanvas = document.createElement('canvas');
        fromCanvas.width = canvasWidth;
        fromCanvas.height = canvasHeight;
        const fromCtx = fromCanvas.getContext('2d');

        const toCanvas = document.createElement('canvas');
        toCanvas.width = canvasWidth;
        toCanvas.height = canvasHeight;
        const toCtx = toCanvas.getContext('2d');

        if (fromCtx && toCtx) {
          // Draw current video with proper aspect ratio to fromCanvas
          this.drawVideoToCanvas(fromCtx, video, canvasWidth, canvasHeight);

          // Draw next video with proper aspect ratio to toCanvas
          this.drawVideoToCanvas(toCtx, this.nextVideoEl, canvasWidth, canvasHeight);

          // Render transition using aspect-corrected canvases
          renderTransition(transitionInfo.type as TransitionType, {
            ctx: this.ctx,
            width: canvasWidth,
            height: canvasHeight,
            fromFrame: fromCanvas,
            toFrame: toCanvas,
            progress: transitionInfo.progress,
          });
        }
      } else {
        // Next video not ready, just draw current frame
        this.drawSingleFrame(video, canvasWidth, canvasHeight);
      }
    } else if (hasVideo) {
      // No transition, just draw current frame
      this.drawSingleFrame(video, canvasWidth, canvasHeight);
    } else {
      // No media fallback
      this.ctx.fillStyle = "#888";
      this.ctx.fillText("No media", 24, 32);
    }

    this.isDrawingFrame = false;
  }

  /**
   * Helper method to draw a video to a canvas with proper aspect ratio
   * This is used both for single frame rendering and transition rendering
   */
  private drawVideoToCanvas(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    // Safety check for video dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return; // Video not ready yet
    }

    // Fill entire canvas with black background first
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

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
    } else {
      // Video is taller - fit to height, add pillarbox (black bars left/right)
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * videoAspect;
      offsetX = (canvasWidth - drawWidth) / 2;
    }

    // Draw video centered with correct aspect ratio
    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
  }

  private drawSingleFrame(
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    if (!this.ctx) return;
    this.drawVideoToCanvas(this.ctx, video, canvasWidth, canvasHeight);
  }

  private getActiveTransition(): {
    type: string;
    progress: number;
  } | null {
    if (!this.currentClip || !this.nextClip) {
      return null;
    }

    const sequence = this.getSequence();
    if (!sequence) return null;

    // Check if current clip has transitions
    if (!this.currentClip.transitions || this.currentClip.transitions.length === 0) {
      return null;
    }

    // Get the first transition (simplified - assumes one transition per clip)
    const transition = this.currentClip.transitions[0];
    if (!transition) return null;

    // Calculate if we're in the transition period
    const clipEnd = this.currentClip.start + this.currentClip.duration;
    const transitionStart = clipEnd - transition.duration;

    if (this.currentTime >= transitionStart && this.currentTime <= clipEnd) {
      // We're in the transition!
      const elapsed = this.currentTime - transitionStart;
      const rawProgress = elapsed / transition.duration;

      // Apply easing function (reconstruct from string identifier)
      const easingFn = getEasingFunction(transition.easing);
      const progress = easingFn(rawProgress);

      return {
        type: transition.type,
        progress: Math.max(0, Math.min(1, progress)),
      };
    }

    return null;
  }

  private resolveClip(sequence: Sequence, time: number) {
    for (const track of sequence.tracks) {
      if (track.kind !== "video") continue;
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

  private syncAudioToTimeline() {
    if (!this.audioContext) return;
    const sequence = this.getSequence();
    if (!sequence) return;

    const audioTracks = sequence.tracks.filter((track) => track.kind === "audio");
    if (audioTracks.length === 0) {
      this.stopAllAudioSources();
      return;
    }

    const narrationTrack = audioTracks.find(
      (track) => track.id === NARRATION_TRACK_ID,
    );
    const narrationActive =
      narrationTrack?.clips.some(
        (clip) =>
          this.currentTime >= clip.start &&
          this.currentTime < clip.start + clip.duration,
      ) ?? false;

    const activeEntries: Array<{ track: Track; clip: Clip }> = [];
    for (const track of audioTracks) {
      for (const clip of track.clips) {
        if (
          this.currentTime >= clip.start &&
          this.currentTime < clip.start + clip.duration
        ) {
          activeEntries.push({ track, clip });
        }
      }
    }

    for (const [clipId, source] of this.audioSources.entries()) {
      const stillActive = activeEntries.some(({ clip }) => clip.id === clipId);
      if (!stillActive) {
        try {
          source.stop();
        } catch {
          // Ignored
        }
        source.disconnect();
        this.audioSources.delete(clipId);
      }
    }

    for (const entry of activeEntries) {
      const { track, clip } = entry;
      if (this.audioSources.has(clip.id)) {
        continue;
      }
      const asset = this.getAsset(clip.mediaId);
      if (!asset) continue;
      const buffer = this.audioBuffers.get(clip.mediaId);
      if (!buffer) continue;

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      const gainNode = this.audioContext.createGain();
      const clipVolume = clip.volume ?? 1;
      const trackVolume = track.volume ?? 1;
      const baseVolume = track.muted ? 0 : clipVolume * trackVolume;
      const isBgmTrack =
        track.id === BGM_TRACK_ID || /bgm/i.test(track.id ?? "");
      const finalVolume =
        isBgmTrack && narrationActive ? baseVolume * 0.5 : baseVolume;
      gainNode.gain.value = finalVolume;

      const destination = this.audioGainNode ?? this.audioContext.destination;
      source.connect(gainNode).connect(destination);

      const clipOffset =
        Math.max(0, this.currentTime - clip.start) + (clip.trimStart ?? 0);
      const remainingDuration = Math.max(
        0,
        clip.duration - (this.currentTime - clip.start),
      );
      const maxOffset = Math.min(clipOffset, buffer.duration);
      const maxDuration = Math.min(
        remainingDuration,
        buffer.duration - maxOffset,
      );

      if (maxDuration <= 0) {
        source.disconnect();
        continue;
      }

      try {
        source.start(0, maxOffset, maxDuration);
      } catch (error) {
        console.error("Failed to start audio clip", error);
        source.disconnect();
        continue;
      }

      source.onended = () => {
        this.audioSources.delete(clip.id);
      };

      this.audioSources.set(clip.id, source);
    }
  }
}
