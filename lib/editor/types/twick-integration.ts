/**
 * Type definitions for Twick VideoEditor integration with Project Store.
 *
 * This file provides comprehensive TypeScript interfaces for the bidirectional
 * state synchronization between Twick's timeline system and our Zustand project store.
 *
 * Architecture Overview:
 * =====================
 *
 * Twick → Project Store Flow:
 * - User edits timeline in Twick UI
 * - Twick updates its internal state (present: ProjectJSON)
 * - present change triggers useEffect in EditorBridge
 * - timelineToProject() converts ProjectJSON → Project
 * - Project is pushed to Zustand store via actions.loadProject()
 *
 * Project Store → Twick Flow:
 * - User action updates Zustand store (e.g., appendClipFromAsset)
 * - project change triggers useEffect in EditorBridge
 * - projectToTimelineJSON() converts Project → ProjectJSON
 * - ProjectJSON is pushed to Twick via editor.loadProject()
 *
 * Feedback Loop Prevention:
 * - Signature comparison (lastProjectSignature, lastTimelineSignature)
 * - Flags to track sync direction (pushingProjectToTimeline, pushingTimelineToProject)
 *
 * @module TwickIntegration
 */

import type { TimelineEditor } from "@twick/timeline";
import type { Track, TrackElement } from "@twick/timeline";
import type { ProjectJSON } from "@twick/timeline/dist/types";
import type { Project, Clip, TimelineSelection } from "../types";

/**
 * Twick timeline event payload when an element (clip) is selected.
 */
export interface TwickSelectionEvent {
  /** The selected track or element */
  item: Track | TrackElement | null;
  /** Whether this is a multi-selection */
  multi?: boolean;
}

/**
 * Twick timeline event payload when playback state changes.
 */
export interface TwickPlaybackEvent {
  /** Whether the timeline is currently playing */
  playing: boolean;
  /** Current playback time in seconds */
  currentTime: number;
}

/**
 * Twick timeline event payload when an element (clip) is dragged.
 */
export interface TwickDragEvent {
  /** The element being dragged */
  element: TrackElement;
  /** Target track ID */
  trackId: string;
  /** New start time in seconds */
  startTime: number;
  /** Whether the drag has ended */
  isDragEnd: boolean;
}

/**
 * Twick timeline event payload when an element (clip) is trimmed.
 */
export interface TwickTrimEvent {
  /** The element being trimmed */
  element: TrackElement;
  /** Amount trimmed from start in seconds */
  trimStart: number;
  /** Amount trimmed from end in seconds */
  trimEnd: number;
}

/**
 * Twick timeline event payload when an element (clip) is split.
 */
export interface TwickSplitEvent {
  /** The element that was split */
  originalElement: TrackElement;
  /** The first (left) element after split */
  leftElement: TrackElement;
  /** The second (right) element after split */
  rightElement: TrackElement;
  /** Split position in seconds (relative to element start) */
  splitOffset: number;
}

/**
 * Twick timeline event payload when an element (clip) is deleted.
 */
export interface TwickDeleteEvent {
  /** The element that was deleted */
  element: TrackElement;
  /** The track it was deleted from */
  trackId: string;
}

/**
 * Sync state for preventing feedback loops in bidirectional sync.
 */
export interface TwickSyncState {
  /** Signature of the last project state pushed to timeline */
  lastProjectSignature: string | null;
  /** Signature of the last timeline state pulled from Twick */
  lastTimelineSignature: string | null;
  /** Flag indicating we're currently pushing project → timeline */
  pushingProjectToTimeline: boolean;
  /** Flag indicating we're currently pulling timeline → project */
  pushingTimelineToProject: boolean;
}

/**
 * Hooks available from Twick's video editor.
 */
export interface TwickEditorHooks {
  /** Timeline context hook providing editor instance and state */
  useTimelineContext: () => {
    editor: TimelineEditor;
    selectedItem: Track | TrackElement | null;
    changeLog: number;
    present: ProjectJSON | null;
    canUndo: boolean;
    canRedo: boolean;
    totalDuration: number;
  };

  /** Player control hook for playback operations */
  usePlayerControl: () => {
    togglePlayback: () => void;
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
  };

  /** Editor manager hook for element operations */
  useEditorManager: () => {
    addElement: (element: TrackElement) => void;
    updateElement: (elementId: string, updates: Partial<TrackElement>) => void;
    removeElement: (elementId: string) => void;
  };

  /** Timeline control hook for advanced operations */
  useTimelineControl: () => {
    splitElement: (elementId: string, offset: number) => void;
    deleteItem: (itemId: string) => void;
    handleUndo: () => void;
    handleRedo: () => void;
  };

  /** Live player context hook for player state */
  useLivePlayerContext: () => {
    playerState: {
      playing: boolean;
      currentTime: number;
      duration: number;
    } | null;
  };
}

/**
 * Type guard to check if an item from Twick has an ID property.
 */
export interface TwickItemWithId {
  id: string;
  [key: string]: unknown;
}

/**
 * Checks if a Twick selected item has an ID property.
 * @param item - The item to check
 * @returns True if the item has an id property
 */
export function isItemWithId(item: unknown): item is TwickItemWithId {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof (item as TwickItemWithId).id === 'string'
  );
}

/**
 * Type guard to check if an item is a Twick TrackElement (clip).
 * TrackElements have properties like startTime, duration, and source that Tracks don't have.
 * @param item - The item to check
 * @returns True if the item is a TrackElement
 */
export function isTrackElement(item: unknown): item is TrackElement {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    ('s' in item || 'startTime' in item) &&
    ('e' in item || 'duration' in item) &&
    (typeof (item as any).s === 'number' || typeof (item as any).startTime === 'number')
  );
}

/**
 * Type guard to check if an item is a Twick Track (container for clips).
 * Tracks have properties like elements array and type property that TrackElements don't have.
 * @param item - The item to check
 * @returns True if the item is a Track
 */
export function isTrack(item: unknown): item is Track {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'elements' in item &&
    Array.isArray((item as any).elements)
  );
}

/**
 * Adapter functions for converting between Project Store and Twick formats.
 */
export interface TwickAdapterFunctions {
  /**
   * Converts a Project to Twick's ProjectJSON format.
   * @param project - The project to convert
   * @returns Twick-compatible ProjectJSON
   */
  projectToTimelineJSON: (project: Project) => ProjectJSON;

  /**
   * Converts Twick's ProjectJSON to our Project format.
   * @param base - Base project to merge timeline data into
   * @param timeline - Twick's ProjectJSON
   * @param assets - Media assets map
   * @returns Updated project
   */
  timelineToProject: (
    base: Project,
    timeline: ProjectJSON,
    assets: Record<string, any>
  ) => Project;
}

/**
 * Props for the EditorBridge component that manages Twick integration.
 */
export interface EditorBridgeProps {
  /** Initial project data (optional) */
  initialProject?: Project;
  /** Callback when timeline state changes */
  onTimelineChange?: (timeline: ProjectJSON) => void;
  /** Callback when selection changes */
  onSelectionChange?: (selection: TimelineSelection) => void;
}

/**
 * Configuration for beat-based snapping in the timeline.
 */
export interface BeatSnapConfig {
  /** Whether beat snapping is enabled */
  enabled: boolean;
  /** Snap tolerance in seconds */
  tolerance: number;
  /** BPM of the audio track */
  bpm: number;
  /** Beat offset in seconds */
  offset: number;
}

/**
 * Visual state for the timeline (zoom, scroll, etc.).
 */
export interface TimelineViewState {
  /** Current zoom level (0.1 to 3.0) */
  zoom: number;
  /** Horizontal scroll position in pixels */
  scrollLeft: number;
  /** Container width in pixels */
  containerWidth: number;
  /** Visible time range start in seconds */
  visibleStart: number;
  /** Visible time range end in seconds */
  visibleEnd: number;
}

/**
 * Result of a timeline operation (for undo/redo).
 */
export interface TimelineOperationResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** The affected clip IDs */
  affectedClipIds: string[];
  /** The previous state (for undo) */
  previousState?: Partial<Project>;
}

/**
 * Options for timeline sync operations.
 */
export interface TwickSyncOptions {
  /** Whether to persist to local storage */
  persist?: boolean;
  /** Whether to add to undo history */
  addToHistory?: boolean;
  /** Whether to skip validation */
  skipValidation?: boolean;
}
