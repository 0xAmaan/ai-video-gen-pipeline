"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VideoEditor, {
  DEFAULT_TIMELINE_TICK_CONFIGS,
  usePlayerControl,
  useEditorManager,
  useTimelineControl,
} from "@twick/video-editor";
import { LivePlayerProvider, useLivePlayerContext } from "@twick/live-player";
import { TimelineProvider, useTimelineContext } from "@twick/timeline";
import { projectToTimelineJSON, timelineToProject } from "@/lib/editor/twick-adapter";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { useSnapManager } from "@/lib/editor/hooks/useSnapManager";
import { useSlipSlideMode, calculatePixelsPerSecond, getCursorForMode } from "@/lib/editor/hooks/useSlipSlideMode";
import { isItemWithId } from "@/lib/editor/types/twick-integration";
import { BeatGridOverlay } from "./BeatGridOverlay";
import { ThumbnailInjector } from "./ThumbnailInjector";
import { EditingModeIndicator } from "./EditingModeIndicator";
import { SlipSlideDragInterceptor } from "./SlipSlideDragInterceptor";
import { TwickMultiSelectInterceptor } from "./TwickMultiSelectInterceptor";
import { SlipSlidePreviewOverlay } from "./SlipSlidePreviewOverlay";
import { HistoryDebugPanel } from "./HistoryDebugPanel";

/**
 * EditorBridge Component
 * ======================
 *
 * Manages bidirectional synchronization between Twick's timeline and Zustand project store.
 * This component serves as the integration layer ensuring both systems stay in sync while
 * preventing infinite update loops.
 *
 * ## Architecture Overview
 *
 * ### Data Flow Patterns:
 *
 * **1. Twick → Project Store** (User edits in UI):
 * ```
 * User Action (drag/trim/split)
 *   ↓
 * Twick updates internal state (present: ProjectJSON)
 *   ↓
 * useEffect detects present change via changeLog
 *   ↓
 * timelineToProject() converts ProjectJSON → Project
 *   ↓
 * actions.loadProject() updates Zustand store
 * ```
 *
 * **2. Project Store → Twick** (Programmatic updates):
 * ```
 * Code calls store action (e.g., appendClipFromAsset)
 *   ↓
 * Zustand project state updates
 *   ↓
 * useEffect detects project change
 *   ↓
 * projectToTimelineJSON() converts Project → ProjectJSON
 *   ↓
 * editor.loadProject() updates Twick timeline
 * ```
 *
 * ### Feedback Loop Prevention:
 *
 * The component uses multiple strategies to prevent infinite sync loops:
 *
 * - **Signature Comparison**: JSON.stringify() both directions and compare signatures
 * - **Direction Flags**: `pushingProjectToTimeline` / `pushingTimelineToProject` refs
 * - **Skip Logic**: When sync is initiated, opposite direction sync is skipped
 *
 * ### Integration Points:
 *
 * - `useTimelineContext()` - Twick editor, selection, undo/redo state
 * - `usePlayerControl()` - Playback control (play, pause, seek)
 * - `useEditorManager()` - Add, update, remove timeline elements
 * - `useTimelineControl()` - Split, delete, undo, redo operations
 * - `useLivePlayerContext()` - Player state (playing, currentTime)
 *
 * ### Keyboard Shortcuts:
 *
 * - `S` - Split clip at playhead
 * - `Delete/Backspace` - Delete selected clip (ripple if enabled)
 * - `R` - Toggle ripple edit mode
 *
 * @component
 * @internal
 */
const EditorBridge = () => {
  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);
  const actions = useProjectStore((state) => state.actions);
  const selection = useProjectStore((state) => state.selection);
  const rippleEditEnabled = useProjectStore((state) => state.rippleEditEnabled);
  const assets = project?.mediaAssets ?? {};

  // Beat grid support
  const { beatMarkers } = useSnapManager();
  const [containerWidth, setContainerWidth] = useState(1200);
  const [containerHeight, setContainerHeight] = useState(600);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [detectedZoom, setDetectedZoom] = useState(1.5); // Twick's default zoom
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  // Slip/slide editing mode support
  const {
    mode: editingMode,
    isSlipMode,
    isSlideMode,
    originalClip,
    previewClip,
    startSlipEdit,
    startSlideEdit,
    updateDrag,
    endEdit,
    cancelEdit,
    detectModeFromModifiers,
    getSlipBounds,
  } = useSlipSlideMode();

  // Twick hooks integration
  const { editor, present, changeLog, selectedItem } = useTimelineContext();
  const { togglePlayback } = usePlayerControl();
  const { addElement, updateElement } = useEditorManager();
  const { splitElement, deleteItem, handleUndo, handleRedo } = useTimelineControl();
  const livePlayerContext = useLivePlayerContext();

  /**
   * Sync State Management (Feedback Loop Prevention)
   * ==================================================
   *
   * These refs track the state of bidirectional sync to prevent infinite loops:
   *
   * - `lastProjectSignature`: JSON signature of last project → timeline push
   * - `lastTimelineSignature`: JSON signature of last timeline → project pull
   * - `pushingProjectToTimeline`: Flag indicating project → timeline sync in progress
   * - `pushingTimelineToProject`: Flag indicating timeline → project sync in progress
   *
   * When a sync is initiated in one direction, the flag is set to skip the opposite
   * direction's useEffect to prevent the change from bouncing back and forth.
   */
  const lastProjectSignature = useRef<string | null>(null);
  const lastTimelineSignature = useRef<string | null>(null);
  const pushingProjectToTimeline = useRef(false);
  const pushingTimelineToProject = useRef(false);

  /**
   * Selection Sync: Twick → Project Store
   * ======================================
   *
   * Syncs the currently selected item in Twick's timeline to the project store.
   * This enables other components (like properties panels) to react to selection changes.
   *
   * Flow:
   * 1. User clicks clip in Twick timeline
   * 2. Twick updates `selectedItem` in context
   * 3. This effect detects the change
   * 4. Updates project store selection with clip ID
   *
   * Note: Both Track and TrackElement have IDs, so we use a type guard to validate.
   */
  useEffect(() => {
    if (isItemWithId(selectedItem)) {
      // We assume it's a clip/element if it has an ID. 
      // Twick types distinguish Track vs TrackElement, but both have IDs.
      // For now, we just select it. The properties panel will decide if it's valid.
      console.log('[EditorController] Syncing selection to store:', selectedItem.id);
      actions.setSelection({ clipIds: [selectedItem.id], trackIds: [] });
    } else {
      console.log('[EditorController] Clearing selection');
      actions.setSelection({ clipIds: [], trackIds: [] });
    }
  }, [selectedItem, actions]);

  /**
   * Playback State Sync: LivePlayer → Project Store
   * ================================================
   *
   * Syncs playback state (playing/paused) from Twick's LivePlayer to the project store.
   * This ensures the store's isPlaying flag stays in sync with the actual player state.
   *
   * Flow:
   * 1. User clicks play/pause in Twick UI
   * 2. LivePlayer updates its playerState
   * 3. This effect detects the change
   * 4. Updates project store isPlaying flag
   *
   * This enables other UI components to react to playback state changes.
   */
  useEffect(() => {
    if (!livePlayerContext) return;
    const { playerState } = livePlayerContext;

    // Sync play/pause state
    const isPlaying = playerState?.playing ?? false;
    const storeIsPlaying = useProjectStore.getState().isPlaying;

    if (isPlaying !== storeIsPlaying) {
      actions.togglePlayback(isPlaying);
    }
  }, [livePlayerContext, actions]);

  // Track modifier keys for slip/slide mode detection
  // Fix: Use refs to avoid re-registering listeners on every editingMode change
  const editingModeRef = useRef(editingMode);
  const detectModeRef = useRef(detectModeFromModifiers);

  useEffect(() => {
    editingModeRef.current = editingMode;
    detectModeRef.current = detectModeFromModifiers;
  }, [editingMode, detectModeFromModifiers]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Update cursor if modifier keys change during drag
      const mode = detectModeRef.current(event);
      if (mode !== editingModeRef.current) {
        // Modifier keys changed - update cursor
        const cursor = getCursorForMode(mode);
        document.body.style.cursor = cursor;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Reset cursor when modifiers are released
      if (!event.altKey && !event.metaKey && !event.ctrlKey) {
        document.body.style.cursor = 'default';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.body.style.cursor = 'default';
    };
  }, []); // Fix: Empty dependencies - only register once

  // Global keyboard shortcuts for editor operations
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // S key: Split clip at playhead
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        const selectedClipId = selection.clipIds[0];
        if (selectedClipId) {
          console.log('[EditorController] Splitting clip at playhead:', selectedClipId);
          actions.splitAtPlayhead(selectedClipId);
        } else {
          console.log('[EditorController] No clip selected for split operation');
        }
      }

      // Delete key: Remove selected clip(s) (with ripple edit if enabled)
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (selection.clipIds.length > 0) {
          console.log('[EditorController] Deleting clips:', selection.clipIds, 'Ripple:', rippleEditEnabled);
          // Delete all selected clips
          selection.clipIds.forEach((clipId) => {
            if (rippleEditEnabled) {
              actions.rippleDelete(clipId);
            } else {
              actions.deleteClip(clipId);
            }
          });
          // Clear selection after deletion
          actions.setSelection({ clipIds: [], trackIds: [] });
        } else {
          console.log('[EditorController] No clips selected for delete operation');
        }
      }

      // R key: Toggle ripple edit mode
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        console.log('[EditorController] Toggling ripple edit mode');
        actions.toggleRippleEdit();
      }

      // Escape key: Cancel slip/slide editing
      if (event.key === 'Escape') {
        if (isSlipMode || isSlideMode) {
          event.preventDefault();
          console.log('[EditorController] Canceling slip/slide edit');
          cancelEdit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selection, rippleEditEnabled, actions]);

  // Expose Twick editor methods and project store actions to window for debugging and external access
  useEffect(() => {
    if (typeof window !== 'undefined' && editor) {
      (window as any).__twickEditor = {
        editor,
        togglePlayback,
        addElement,
        updateElement,
        splitElement,
        deleteItem,
        undo: handleUndo,
        redo: handleRedo,
        livePlayerContext,
        // Project store actions for keyboard shortcuts
        projectStore: {
          toggleRippleEdit: actions.toggleRippleEdit,
          splitAtPlayhead: actions.splitAtPlayhead,
          deleteClip: actions.deleteClip,
          rippleDelete: actions.rippleDelete,
          rippleEditEnabled,
        },
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__twickEditor;
      }
    };
  }, [editor, togglePlayback, addElement, updateElement, splitElement, deleteItem, handleUndo, handleRedo, livePlayerContext, actions, rippleEditEnabled]);

  /**
   * Bidirectional Sync: Project Store → Twick Timeline
   * ===================================================
   *
   * Syncs changes from the Zustand project store to Twick's timeline.
   * This effect is triggered when the project state changes programmatically
   * (e.g., via actions.appendClipFromAsset, actions.moveClip, etc.)
   *
   * Flow:
   * 1. Code calls a project store action (e.g., appendClipFromAsset)
   * 2. Zustand updates the project state
   * 3. This effect detects the change via project/assets deps
   * 4. Converts Project → ProjectJSON via projectToTimelineJSON()
   * 5. Pushes to Twick via editor.loadProject()
   *
   * Feedback Loop Prevention:
   * - Checks `pushingTimelineToProject` flag and skips if set (opposite direction sync)
   * - Compares signatures to skip if no actual change occurred
   * - Sets `pushingProjectToTimeline` flag to signal downstream sync
   * - Keeps both signatures in sync after push to prevent bouncing
   *
   * Dependencies: [assets, editor, project, ready]
   * - `assets`: Triggers when media assets change (for clip metadata)
   * - `editor`: The Twick editor instance
   * - `project`: The full project state from Zustand
   * - `ready`: Only sync when project store is hydrated
   */
  useEffect(() => {
    if (!ready || !project) return;
    if (pushingTimelineToProject.current) {
      // Skip reacting to changes we initiated from the timeline->project sync.
      pushingTimelineToProject.current = false;
      return;
    }

    try {
      const timeline = projectToTimelineJSON(project);
      const signature = JSON.stringify(timeline);

      if (lastProjectSignature.current === signature) return;

      // Validate timeline has tracks before pushing to Twick
      if (!timeline.tracks || timeline.tracks.length === 0) {
        console.warn('[EditorController] Skipping empty timeline push to Twick');
        return;
      }

      pushingProjectToTimeline.current = true;
      editor.loadProject(timeline);
      lastProjectSignature.current = signature;
      lastTimelineSignature.current = signature; // keep both in sync after a push
      pushingProjectToTimeline.current = false;
    } catch (error) {
      console.error('[EditorController] Error syncing project to timeline:', error);
      pushingProjectToTimeline.current = false; // Reset flag on error
    }
  }, [assets, editor, project, ready]);

  /**
   * Bidirectional Sync: Twick Timeline → Project Store
   * ===================================================
   *
   * Syncs changes from Twick's timeline to the Zustand project store.
   * This effect is triggered when users interact with the Twick UI
   * (e.g., dragging clips, trimming, splitting, etc.)
   *
   * Flow:
   * 1. User performs timeline operation in Twick UI
   * 2. Twick updates its internal state (present: ProjectJSON)
   * 3. This effect detects the change via changeLog increment
   * 4. Converts ProjectJSON → Project via timelineToProject()
   * 5. Pushes to store via actions.loadProject()
   *
   * Feedback Loop Prevention:
   * - Checks `pushingProjectToTimeline` flag and skips if set (opposite direction sync)
   * - Compares signatures to skip if no actual change occurred
   * - Sets `pushingTimelineToProject` flag to signal downstream sync
   *
   * Dependencies: [actions, assets, changeLog, present, project, ready]
   * - `actions`: Project store actions (specifically loadProject)
   * - `assets`: Media assets for clip metadata enrichment
   * - `changeLog`: Twick's change counter (increments on any timeline mutation)
   * - `present`: Current timeline state from Twick
   * - `project`: Base project to merge timeline data into
   * - `ready`: Only sync when project store is hydrated
   *
   * Note: We persist to Convex on every sync with { persist: true }
   */
  useEffect(() => {
    if (!ready || !project || !present) return;
    if (pushingProjectToTimeline.current) {
      // Skip reacting to changes we initiated from the project->timeline sync.
      pushingProjectToTimeline.current = false;
      return;
    }

    try {
      const signature = JSON.stringify(present);
      if (lastTimelineSignature.current === signature) return;

      // Validate that present has valid structure before converting
      if (!present.tracks || !Array.isArray(present.tracks)) {
        console.warn('[EditorController] Invalid timeline structure from Twick, skipping sync');
        return;
      }

      const nextProject = timelineToProject(project, present, assets);

      // Validate the converted project has required structure
      if (!nextProject.sequences || nextProject.sequences.length === 0) {
        console.error('[EditorController] Timeline conversion resulted in invalid project structure');
        return;
      }

      lastTimelineSignature.current = signature;
      pushingTimelineToProject.current = true;
      // Let Zustand subscription handle Convex saves (debounced)
      // Persist: false prevents immediate duplicate save
      void actions.loadProject(nextProject, { persist: false });
    } catch (error) {
      console.error('[EditorController] Error syncing timeline to project:', error);
      pushingTimelineToProject.current = false; // Reset flag on error
    }
  }, [actions, assets, changeLog, present, project, ready]);

  // Track container width for beat grid overlay
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Observe Twick timeline scroll for beat grid sync
  useEffect(() => {
    const findAndAttachScrollListener = () => {
      const timelineScrollContainer = document.querySelector('.twick-timeline-scroll-container');

      if (!timelineScrollContainer) {
        return false;
      }

      const handleScroll = () => {
        setScrollLeft(timelineScrollContainer.scrollLeft);
      };

      timelineScrollContainer.addEventListener('scroll', handleScroll);
      // Get initial scroll position
      handleScroll();

      return () => {
        timelineScrollContainer.removeEventListener('scroll', handleScroll);
      };
    };

    // Try immediately
    let cleanup = findAndAttachScrollListener();
    let found = false;

    // If not found, retry with delays
    if (!cleanup) {
      const timeouts: NodeJS.Timeout[] = [];
      [100, 500, 1000].forEach(delay => {
        timeouts.push(setTimeout(() => {
          if (!found && !cleanup) {
            cleanup = findAndAttachScrollListener();
            if (cleanup) found = true;
          }
        }, delay));
      });

      return () => {
        found = true; // Cancel pending retries
        timeouts.forEach(t => clearTimeout(t));
        if (typeof cleanup === 'function') cleanup();
      };
    }

    return typeof cleanup === 'function' ? cleanup : undefined;
  }, []);

  // Detect Twick timeline zoom level via DOM observation
  useEffect(() => {
    const sequence = project?.sequences[0];
    const duration = sequence?.duration ?? 300;

    if (duration <= 0) return;

    const detectZoomFromDOM = () => {
      // Query the timeline content div that has width style applied
      const timelineContent = document.querySelector('.twick-timeline-scroll-container > div');

      if (!timelineContent) {
        return false;
      }

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry && duration > 0) {
          const timelineWidth = entry.contentRect.width;
          // Reverse Twick's formula: width = duration * zoom * 100
          const calculatedZoom = timelineWidth / (duration * 100);

          // Clamp to Twick's zoom range (0.1 to 3.0)
          const clampedZoom = Math.max(0.1, Math.min(3.0, calculatedZoom));

          setDetectedZoom(clampedZoom);
        }
      });

      observer.observe(timelineContent);

      // Initial measurement
      const timelineWidth = timelineContent.getBoundingClientRect().width;
      if (duration > 0) {
        const initialZoom = Math.max(0.1, Math.min(3.0, timelineWidth / (duration * 100)));
        setDetectedZoom(initialZoom);
      }

      return () => observer.disconnect();
    };

    // Try immediately
    let cleanup = detectZoomFromDOM();
    let found = false;

    // Retry if not found
    if (!cleanup) {
      const timeouts: NodeJS.Timeout[] = [];
      [100, 500, 1000].forEach(delay => {
        timeouts.push(setTimeout(() => {
          if (!found && !cleanup) {
            cleanup = detectZoomFromDOM();
            if (cleanup) found = true;
          }
        }, delay));
      });

      return () => {
        found = true; // Cancel pending retries
        timeouts.forEach(t => clearTimeout(t));
        if (typeof cleanup === 'function') cleanup();
      };
    }

    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [project]);

  const sequence = project?.sequences[0];
  const duration = sequence?.duration ?? 300; // Default 5 minutes

  // Track cursor position for editing mode indicator
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isSlipMode || isSlideMode) {
        setCursorPosition({ x: e.clientX, y: e.clientY });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isSlipMode, isSlideMode]);

  return (
    <div ref={containerRef} id="twick-timeline-only" className="relative h-full w-full">
      {/* Timeline thumbnail injector - adds thumbnails to timeline elements via direct styling */}
      <ThumbnailInjector />

      {/* Slip/slide drag interceptor - intercepts drag events when Alt/Cmd+Alt is held */}
      <SlipSlideDragInterceptor />

      {/* Multi-selection interceptor - adds Shift+Click and Cmd+Click multi-selection */}
      <TwickMultiSelectInterceptor />

      <VideoEditor
        editorConfig={{
          videoProps: {
            width: sequence?.width ?? 1920,
            height: sequence?.height ?? 1080,
          },
          timelineTickConfigs: DEFAULT_TIMELINE_TICK_CONFIGS,
        }}
      />

      {/* Beat Grid Overlay */}
      {beatMarkers.length > 0 && (
        <BeatGridOverlay
          beatMarkers={beatMarkers}
          duration={duration}
          containerWidth={containerWidth}
          scrollLeft={scrollLeft}
          zoom={detectedZoom}
        />
      )}

      {/* Slip/Slide Preview Overlay - Real-time frame and position preview */}
      <SlipSlidePreviewOverlay
        mode={editingMode}
        previewClip={previewClip}
        originalClip={originalClip}
        tracks={sequence?.tracks ?? []}
        mediaAssets={assets}
        zoom={detectedZoom}
        scrollLeft={scrollLeft}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
      />

      {/* Editing Mode Indicator */}
      <EditingModeIndicator
        mode={editingMode}
        clipId={selection.clipIds[0] ?? null}
        visible={isSlipMode || isSlideMode}
        position={cursorPosition ?? undefined}
      />

      {/* History Debug Panel - Shows command history and undo/redo state */}
      <HistoryDebugPanel visible={true} maxItems={10} />
    </div>
  );
};

export const EditorController = () => {
  // Performance optimization: Only subscribe to project ID for the initial data serialization
  // Updates are handled by the inner EditorBridge component
  const project = useProjectStore((state) => state.project);
  const projectId = project?.id;
  
  // Only re-calculate initialData when the project ID changes, NOT on every update.
  // This prevents TimelineProvider from re-mounting/resetting during editing.
  const initialData = useMemo(
    () => (project ? projectToTimelineJSON(project) : undefined),
    [projectId], 
  );

  if (!project) return null;

  return (
    <div className="h-full w-full bg-background">
      <LivePlayerProvider>
        <TimelineProvider
          contextId="twick-editor"
          resolution={{
            width: project.sequences[0]?.width ?? 1920,
            height: project.sequences[0]?.height ?? 1080,
          }}
          initialData={
            initialData ?? {
              tracks: [],
              version: 1,
            }
          }
          undoRedoPersistenceKey={`twick-history-${projectId}`}
          maxHistorySize={150}
        >
          <EditorBridge />
        </TimelineProvider>
      </LivePlayerProvider>
    </div>
  );
};

export default EditorController;