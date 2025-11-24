/**
 * Video Player Types
 *
 * Type definitions for the canvas-based video player rendering engine.
 * Separated from main editor types for clarity and modularity.
 */

import type { Sequence } from "../types";

import type { MediaAssetMeta } from "../types";

/**
 * Props for the VideoPlayer React component
 */
export interface VideoPlayerProps {
  /** Sequence to render (contains all clips, effects, transitions) */
  sequence: Sequence;

  /** Media assets referenced by clips */
  mediaAssets: Record<string, MediaAssetMeta>;

  /** Current playback time in seconds */
  currentTime: number;

  /** Whether video is currently playing */
  isPlaying: boolean;

  /** Master volume (0-1), defaults to 1 */
  masterVolume?: number;

  /** Optional CSS class name for container */
  className?: string;

  /** Callback fired during playback with current time */
  onTimeUpdate?: (time: number) => void;

  /** Callback fired when playback ends */
  onEnded?: () => void;

  /** Callback fired on render errors */
  onError?: (error: Error) => void;
}

/**
 * Configuration for frame renderer
 */
export interface FrameRendererConfig {
  /** Canvas width in pixels */
  width: number;

  /** Canvas height in pixels */
  height: number;

  /** Enable frame caching for performance */
  enableCache?: boolean;

  /** Maximum cache size in number of frames */
  maxCacheSize?: number;

  /** Use WebGL for rendering (vs Canvas 2D) */
  useWebGL?: boolean;
}

/**
 * Represents a loaded video frame ready for rendering
 */
export interface VideoFrame {
  /** Source video element or ImageBitmap */
  source: HTMLVideoElement | ImageBitmap;

  /** Timestamp this frame represents */
  timestamp: number;

  /** Clip ID this frame belongs to */
  clipId: string;
}

/**
 * Audio track configuration for mixing
 */
export interface AudioTrackConfig {
  /** Unique identifier */
  id: string;

  /** Audio source URL */
  url: string;

  /** Start time on timeline (seconds) */
  startTime: number;

  /** Playback offset in source media (seconds) */
  offset: number;

  /** Duration to play (seconds) */
  duration: number;

  /** Volume level (0-1) */
  volume: number;

  /** Whether track is muted */
  muted: boolean;
}

/**
 * Playback state managed by PlaybackController
 */
export interface PlaybackState {
  /** Current playback time */
  currentTime: number;

  /** Whether currently playing */
  isPlaying: boolean;

  /** Playback speed multiplier (1.0 = normal) */
  playbackRate: number;

  /** Whether playback is seeking */
  isSeeking: boolean;
}
