/**
 * Timeline-specific types
 *
 * The timeline is a UI-only component that handles editing interactions.
 * It reads sequence data from props and fires callbacks for user actions.
 * See TIMELINE_SEPARATION_OF_CONCERNS.md for architecture details.
 */

import type { Sequence, MediaAssetMeta } from "@/lib/editor/types";

/**
 * Timeline component props following separation of concerns:
 * - Timeline = State Editor (displays and manipulates clip data)
 * - VideoPlayer = Rendering Engine (renders composite frames)
 */
export interface TimelineProps {
  // ========== READ-ONLY DATA ==========
  // Timeline displays this data but never modifies it directly

  /** Sequence containing all tracks, clips, and effects */
  sequence: Sequence;

  /** Media assets for loading thumbnails */
  mediaAssets: Record<string, MediaAssetMeta>;

  /** Current playback time in seconds */
  currentTime: number;

  /** Whether video is currently playing */
  isPlaying: boolean;

  /** IDs of currently selected clips */
  selectedClipIds: string[];

  /** Total duration of the sequence in seconds */
  duration: number;

  /** Ref to the parent section element for observing resize */
  timelineSectionRef?: React.RefObject<HTMLElement | null>;

  /** Called when user toggles play/pause */
  onPlayPause: () => void;

  // ========== USER ACTION CALLBACKS ==========
  // Timeline fires these when user performs editing actions

  /** Called when user seeks to a new time (click or scrub timeline) */
  onSeek: (time: number) => void;

  /** Called when user moves a clip to new position/track (may update multiple clips due to push logic) */
  onClipMove: (updates: { clipId: string; newStart: number }[]) => void;

  /** Called when user trims a clip (adjusts in/out points) */
  onClipTrim: (clipId: string, trimStart: number, trimEnd: number) => void;

  /** Called when user changes clip selection */
  onClipSelect: (clipIds: string[]) => void;

  /** Called when user deletes clips */
  onClipDelete: (clipIds: string[]) => void;

  // ========== OPTIONAL FEATURES ==========

  /** Enable magnetic snapping to clips, playhead, and markers */
  magneticSnapEnabled?: boolean;

  /** Show beat markers for music-synced editing */
  showBeatMarkers?: boolean;

  /** Beat marker positions in seconds */
  beatMarkers?: number[];
}

/**
 * Zoom state for timeline scaling
 */
export interface TimelineZoom {
  /** Current zoom level (0.5x to 4.0x) */
  level: number;

  /** Pixels per second at 1.0x zoom */
  basePixelsPerSecond: number;

  /** Calculated pixels per second (base * level) */
  pixelsPerSecond: number;
}

/**
 * Timeline viewport state
 */
export interface TimelineViewport {
  /** Horizontal scroll offset in pixels */
  scrollX: number;

  /** Vertical scroll offset in pixels */
  scrollY: number;

  /** Viewport width in pixels */
  width: number;

  /** Viewport height in pixels */
  height: number;
}

/**
 * Clip bounds for rendering and interaction
 */
export interface ClipBounds {
  /** Clip ID */
  id: string;

  /** X position in pixels */
  x: number;

  /** Y position in pixels */
  y: number;

  /** Width in pixels */
  width: number;

  /** Height in pixels */
  height: number;

  /** Track index */
  trackIndex: number;
}

/**
 * Snap guide for magnetic snapping visual feedback
 */
export interface SnapGuide {
  /** Time position of snap point in seconds */
  time: number;

  /** X position in pixels */
  x: number;

  /** Type of snap point */
  type: "clip" | "playhead" | "beat";
}

/**
 * Drag state for clip dragging
 */
export interface ClipDragState {
  /** IDs of clips being dragged */
  clipIds: string[];

  /** Starting mouse X position */
  startX: number;

  /** Starting mouse Y position */
  startY: number;

  /** Original clip start times (before drag) */
  originalStarts: Map<string, number>;

  /** Original track IDs (before drag) */
  originalTrackIds: Map<string, string>;

  /** Current snap guide (if snapping) */
  snapGuide: SnapGuide | null;
}

/**
 * Trim state for clip trimming
 */
export interface ClipTrimState {
  /** Clip being trimmed */
  clipId: string;

  /** Which handle ('left' or 'right') */
  handle: "left" | "right";

  /** Starting mouse X position */
  startX: number;

  /** Original trim values */
  originalTrimStart: number;
  originalTrimEnd: number;
}

/**
 * Selection box state for marquee selection
 */
export interface SelectionBoxState {
  /** Starting X position */
  startX: number;

  /** Starting Y position */
  startY: number;

  /** Current X position */
  currentX: number;

  /** Current Y position */
  currentY: number;
}

/**
 * Timeline theme colors (CapCut-inspired)
 */
export const TIMELINE_THEME = {
  // Backgrounds
  background: "#18181b", // zinc-900
  trackAltRow: "#27272a", // zinc-800
  ruler: "#0a0a0a",

  // Clips
  clip: "#3a3a3a",
  clipBorder: "#4a4a4a",
  clipSelected: "#5b8ff9",
  clipHover: "#454545",

  // Playhead & scrubber
  playhead: "#ff4d4f",
  scrubber: "#ff4d4f80", // 50% opacity

  // Snap guides
  snapGuide: "#ff4d4f",

  // Audio waveform
  waveform: "#52c41a",

  // Text
  textPrimary: "#ffffff",
  textSecondary: "#999999",
  textMuted: "#666666",

  // Selection box
  selectionBox: "#5b8ff950", // 30% opacity
  selectionBoxBorder: "#5b8ff9",
} as const;

/**
 * Timeline layout constants
 */
export const TIMELINE_LAYOUT = {
  // Ruler
  rulerHeight: 32,
  tracksTopMargin: 40, // Vertical spacing below ruler

  // Tracks
  trackHeight: 60,
  trackLabelWidth: 120,
  trackPadding: 4,

  // Clips
  clipBorderRadius: 8,
  clipPadding: 4,
  clipBorderWidth: 2,
  clipSelectedBorderWidth: 2,
  clipGap: 1, // Gap between adjacent clips

  // Trim handles
  trimHandleWidth: 6,
  trimHandleColor: "#ffffff",

  // Snap
  snapThreshold: 0.1, // seconds
  snapGuideWidth: 2,

  // Zoom
  zoomMin: 0.5,
  zoomMax: 4.0,
  zoomStep: 0.1,
  basePixelsPerSecond: 50,
} as const;
