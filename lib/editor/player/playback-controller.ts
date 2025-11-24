/**
 * PlaybackController
 *
 * Manages playback state and RequestAnimationFrame loop.
 * Coordinates between FrameRenderer and AudioMixer.
 */

import type { Sequence, MediaAssetMeta } from "../types";
import type { FrameRenderer } from "./frame-renderer";
import { AudioMixer } from "../audio/audio-mixer";

interface PlaybackCallbacks {
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

export class PlaybackController {
  private sequence: Sequence;
  private frameRenderer: FrameRenderer;
  private audioMixer: AudioMixer;
  private callbacks: PlaybackCallbacks;
  private mediaAssets: Record<string, MediaAssetMeta> = {};

  // Playback state
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private masterVolume: number = 1.0;

  // RAF loop
  private rafId: number | null = null;
  private lastFrameTime: number = 0;

  // Seeking state
  private isSeeking: boolean = false;
  private pendingSeekTime: number | null = null;

  constructor(
    frameRenderer: FrameRenderer,
    sequence: Sequence,
    mediaAssets: Record<string, MediaAssetMeta>,
    callbacks: PlaybackCallbacks = {},
  ) {
    this.frameRenderer = frameRenderer;
    this.sequence = sequence;
    this.mediaAssets = mediaAssets;
    this.callbacks = callbacks;

    // Initialize frame renderer with media assets
    this.frameRenderer.setMediaAssets(mediaAssets);

    // Initialize audio mixer
    this.audioMixer = new AudioMixer(
      () => this.sequence,
      (id: string) => this.mediaAssets[id],
    );

    // Preload audio assets
    this.audioMixer.preloadAudioAssets(mediaAssets).catch((error) => {
      console.warn("Failed to preload audio assets:", error);
    });
  }

  /**
   * Start playback
   */
  async play(): Promise<void> {
    if (this.isPlaying) return;

    // Resume audio context (needed after user interaction on some browsers)
    await this.audioMixer.resume();

    // Disable cache trimming during playback to prevent flickering
    this.frameRenderer.setPlaybackMode(true);

    this.isPlaying = true;
    // Don't set lastFrameTime here - let first RAF tick set it
    // to avoid negative delta issues
    this.lastFrameTime = 0;

    // Start audio playback
    await this.audioMixer.play(this.currentTime);

    this.startRAFLoop();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.stopRAFLoop();

    // Pause audio
    this.audioMixer.pause();

    // Re-enable cache trimming when paused
    this.frameRenderer.setPlaybackMode(false);
  }

  /**
   * Seek to a specific time
   */
  async seek(time: number): Promise<void> {
    // Clamp time to valid range
    const clampedTime = Math.max(0, Math.min(time, this.sequence.duration));

    this.currentTime = clampedTime;
    this.pendingSeekTime = clampedTime;

    // Seek audio to new time
    await this.audioMixer.seek(clampedTime);

    // If not playing, render the frame immediately
    if (!this.isPlaying) {
      await this.renderCurrentFrame();
    }
  }

  /**
   * Update the sequence (when clips/effects change)
   */
  updateSequence(
    sequence: Sequence,
    mediaAssets?: Record<string, MediaAssetMeta>,
  ): void {
    this.sequence = sequence;

    if (mediaAssets) {
      this.mediaAssets = mediaAssets;
      this.frameRenderer.setMediaAssets(mediaAssets);

      // Preload any new audio assets
      this.audioMixer.preloadAudioAssets(mediaAssets).catch((error) => {
        console.warn("Failed to preload audio assets:", error);
      });
    }

    // Re-render current frame with new sequence data
    if (!this.isPlaying) {
      this.renderCurrentFrame().catch((error) => {
        console.error("Error rendering frame after sequence update:", error);
        this.callbacks.onError?.(
          error instanceof Error ? error : new Error("Render failed"),
        );
      });
    }
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.audioMixer.setMasterVolume(volume);
  }

  /**
   * Destroy controller and cleanup
   */
  destroy(): void {
    this.stopRAFLoop();
    this.isPlaying = false;
    this.audioMixer.dispose();
  }

  /**
   * Start RequestAnimationFrame loop
   */
  private startRAFLoop(): void {
    if (this.rafId !== null) return;

    console.log("[PlaybackController] Starting RAF loop");

    const tick = (timestamp: number) => {
      if (!this.isPlaying) {
        console.log("[PlaybackController] RAF loop stopped - not playing");
        return;
      }

      // Initialize lastFrameTime on first tick to avoid negative delta
      if (this.lastFrameTime === 0) {
        this.lastFrameTime = timestamp;
        this.rafId = requestAnimationFrame(tick);
        return;
      }

      // Calculate delta time
      const deltaMs = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      // Update current time based on FPS
      const deltaSeconds = deltaMs / 1000;
      this.currentTime += deltaSeconds;

      console.log(
        `[PlaybackController] RAF tick - currentTime: ${this.currentTime.toFixed(3)}s, delta: ${deltaMs.toFixed(1)}ms`,
      );

      // Check if playback has ended
      if (this.currentTime >= this.sequence.duration) {
        this.currentTime = this.sequence.duration;
        this.pause();
        this.callbacks.onEnded?.();
        return;
      }

      // Render frame
      this.renderCurrentFrame().catch((error) => {
        console.error("Error rendering frame during playback:", error);
        this.callbacks.onError?.(
          error instanceof Error ? error : new Error("Render failed"),
        );
        this.pause();
      });

      // Notify time update
      this.callbacks.onTimeUpdate?.(this.currentTime);

      // Schedule next frame
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Stop RequestAnimationFrame loop
   */
  private stopRAFLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Render the current frame
   */
  private async renderCurrentFrame(): Promise<void> {
    try {
      this.isSeeking = true;
      await this.frameRenderer.renderFrame(this.sequence, this.currentTime);
    } catch (error) {
      console.error("Frame render error:", error);
      throw error;
    } finally {
      this.isSeeking = false;
      this.pendingSeekTime = null;
    }
  }
}
