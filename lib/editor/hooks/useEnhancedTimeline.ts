"use client";

import { useMemo } from "react";
import { useProjectStore } from "../core/project-store";
import { useTimelineQueries } from "./useTimelineQueries";
import { useTwickEditor } from "./useTwickEditor";
import type { Clip, TimelineSelection } from "../types";

/**
 * Operation result with discriminated union for success/error states
 */
export type OperationResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * useEnhancedTimeline Hook
 * ========================
 *
 * A unified custom hook that combines Twick's native hooks with project-specific
 * logic for streamlined timeline operations. This hook aggregates functionality
 * from multiple sources into a single, convenient interface.
 *
 * ## Architecture
 *
 * This hook combines:
 * - `useTimelineQueries()` - Timeline query utilities (clips in range, gaps, etc.)
 * - `useProjectStore()` - Zustand project state and actions
 * - `useTwickEditor()` - Global Twick editor instance (optional)
 *
 * ## Features
 *
 * ### Timeline Queries
 * - Get clips within time ranges
 * - Find gaps on tracks
 * - Locate clips at specific timestamps
 * - Track duration calculations
 *
 * ### Playback Control
 * - Play, pause, seek operations
 * - Current time tracking
 * - Playback state management
 *
 * ### Editing Operations
 * - Split, delete, move clips
 * - Ripple delete support
 * - Undo/redo with command pattern
 * - Batch operations for multi-clip selection
 *
 * ### Selection Management
 * - Select/deselect clips
 * - Multi-clip selection support
 * - Get selected clips
 *
 * ### State Access
 * - Project data
 * - Timeline settings
 * - Editor modes (ripple edit, etc.)
 *
 * ## Usage Example
 *
 * ```tsx
 * const MyComponent = () => {
 *   const timeline = useEnhancedTimeline();
 *
 *   // Query clips in range
 *   const clips = timeline.timeline.getClipsInRange(10, 20);
 *
 *   // Playback control
 *   const handlePlay = () => timeline.playback.play();
 *
 *   // Delete selected clips
 *   const handleDelete = () => {
 *     const result = timeline.editing.deleteSelectedClips();
 *     if (!result.success) {
 *       console.error(result.error);
 *     }
 *   };
 *
 *   // Split at playhead
 *   timeline.editing.splitSelectedAtPlayhead();
 *
 *   return (
 *     <div>
 *       <button onClick={handlePlay}>Play</button>
 *       <button onClick={handleDelete}>Delete</button>
 *       <p>Current time: {timeline.state.currentTime}s</p>
 *     </div>
 *   );
 * };
 * ```
 */
export const useEnhancedTimeline = () => {
  // Aggregate all hooks
  const timelineQueries = useTimelineQueries();
  const twickEditor = useTwickEditor();
  const project = useProjectStore((state) => state.project);
  const selection = useProjectStore((state) => state.selection);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const currentTime = useProjectStore((state) => state.currentTime);
  const rippleEditEnabled = useProjectStore((state) => state.rippleEditEnabled);
  const multiTrackRipple = useProjectStore((state) => state.multiTrackRipple);
  const historyManager = useProjectStore((state) => state.historyManager);
  const ready = useProjectStore((state) => state.ready);
  const dirty = useProjectStore((state) => state.dirty);
  const collisionDetector = useProjectStore((state) => state.collisionDetector);
  const actions = useProjectStore((state) => state.actions);

  /**
   * Timeline query methods
   * Efficient queries for clips, gaps, and timeline analysis
   */
  const timeline = useMemo(
    () => ({
      /**
       * Get all clips within a time range, optionally filtered by track
       *
       * @param startTime - Start time in seconds
       * @param endTime - End time in seconds
       * @param trackId - Optional track ID to filter results
       * @returns Array of clips within the range
       *
       * @example
       * const clips = timeline.getClipsInRange(10, 20); // All clips between 10-20s
       * const trackClips = timeline.getClipsInRange(10, 20, 'video-1'); // Only video-1 track
       */
      getClipsInRange: timelineQueries.getClipsInRange,

      /**
       * Find all gaps (empty regions) on a track
       *
       * @param trackId - Track ID to analyze
       * @returns Array of gaps sorted by start time
       *
       * @example
       * const gaps = timeline.findGaps('audio-1');
       * // Returns [{start: 5, duration: 3, end: 8}, ...]
       */
      findGaps: timelineQueries.findGaps,

      /**
       * Find clip at specific timestamp on a track
       *
       * @param timestamp - Time in seconds
       * @param trackId - Track ID to search
       * @returns Clip at timestamp or null if no clip found
       *
       * @example
       * const clip = timeline.getClipAt(15.5, 'video-1');
       */
      getClipAt: timelineQueries.getClipAt,

      /**
       * Convert Y pixel coordinate to track ID
       *
       * @param yPosition - Y coordinate in pixels
       * @returns Track ID at that Y position or null if not found
       */
      getTrackAtY: timelineQueries.getTrackAtY,

      /**
       * Get all clips on a specific track
       *
       * @param trackId - Track ID
       * @returns Array of clips on the track
       */
      getClipsOnTrack: timelineQueries.getClipsOnTrack,

      /**
       * Get total duration of all clips on a track
       *
       * @param trackId - Track ID
       * @returns Total duration in seconds
       */
      getTrackDuration: timelineQueries.getTrackDuration,

      /**
       * Check if a time range is empty (no clips) on a track
       *
       * @param trackId - Track ID
       * @param startTime - Start time in seconds
       * @param endTime - End time in seconds
       * @returns True if range is empty, false if any clips exist
       */
      isRangeEmpty: timelineQueries.isRangeEmpty,
    }),
    [timelineQueries]
  );

  /**
   * Playback control methods
   * Control playback state and timeline position
   */
  const playback = useMemo(
    () => ({
      /**
       * Toggle playback (play/pause)
       *
       * @example
       * playback.togglePlayback();
       */
      togglePlayback: () => {
        actions.togglePlayback();
      },

      /**
       * Start playback
       *
       * @example
       * playback.play();
       */
      play: () => {
        actions.togglePlayback(true);
      },

      /**
       * Pause playback
       *
       * @example
       * playback.pause();
       */
      pause: () => {
        actions.togglePlayback(false);
      },

      /**
       * Seek to specific time
       *
       * @param time - Time in seconds
       *
       * @example
       * playback.seek(30); // Seek to 30 seconds
       */
      seek: (time: number) => {
        actions.setCurrentTime(time);
      },

      /**
       * Scrub timeline (seek while dragging)
       * Alias for seek, semantically indicates user is dragging
       *
       * @param time - Time in seconds
       *
       * @example
       * playback.scrub(15.5);
       */
      scrub: (time: number) => {
        actions.setCurrentTime(time);
      },

      /**
       * Shuttle forward/backward by delta
       *
       * @param delta - Time delta in seconds (positive = forward, negative = backward)
       *
       * @example
       * playback.shuttle(5); // Jump forward 5 seconds
       * playback.shuttle(-2); // Jump backward 2 seconds
       */
      shuttle: (delta: number) => {
        actions.setCurrentTime(currentTime + delta);
      },
    }),
    [actions, currentTime]
  );

  /**
   * Editing operation methods
   * Clip manipulation, splitting, deletion, and undo/redo
   */
  const editing = useMemo(
    () => ({
      /**
       * Split clip at specific offset from clip start
       *
       * @param clipId - Clip ID to split
       * @param offset - Offset from clip start in seconds
       * @returns Operation result
       *
       * @example
       * const result = editing.split('clip-123', 5); // Split 5 seconds into clip
       */
      split: (clipId: string, offset: number): OperationResult => {
        try {
          actions.splitClip(clipId, offset);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Split clip at current playhead position
       *
       * @param clipId - Clip ID to split
       * @returns Operation result
       *
       * @example
       * const result = editing.splitAtPlayhead('clip-123');
       */
      splitAtPlayhead: (clipId: string): OperationResult => {
        try {
          actions.splitAtPlayhead(clipId);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Delete a single clip
       *
       * @param clipId - Clip ID to delete
       * @returns Operation result
       *
       * @example
       * const result = editing.delete('clip-123');
       */
      delete: (clipId: string): OperationResult => {
        try {
          actions.deleteClip(clipId);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Delete clip with ripple (shift subsequent clips left)
       *
       * @param clipId - Clip ID to delete
       * @returns Operation result
       *
       * @example
       * const result = editing.rippleDelete('clip-123');
       */
      rippleDelete: (clipId: string): OperationResult => {
        try {
          actions.rippleDelete(clipId);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Batch delete multiple clips
       *
       * @param clipIds - Array of clip IDs to delete
       * @returns Operation result
       *
       * @example
       * const result = editing.deleteClips(['clip-1', 'clip-2', 'clip-3']);
       */
      deleteClips: (clipIds: string[]): OperationResult => {
        try {
          actions.deleteClips(clipIds);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Move a single clip to new position
       *
       * @param clipId - Clip ID to move
       * @param trackId - Target track ID
       * @param start - New start time in seconds
       * @returns Operation result
       *
       * @example
       * const result = editing.moveClip('clip-123', 'video-1', 10);
       */
      moveClip: (clipId: string, trackId: string, start: number): OperationResult => {
        try {
          actions.moveClip(clipId, trackId, start);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Batch move multiple clips by offset
       *
       * @param clipIds - Array of clip IDs to move
       * @param timeOffset - Time offset in seconds
       * @param trackOffset - Optional track offset (number of tracks to move)
       * @returns Operation result
       *
       * @example
       * const result = editing.moveClips(['clip-1', 'clip-2'], 5); // Move 5s forward
       */
      moveClips: (
        clipIds: string[],
        timeOffset: number,
        trackOffset?: number
      ): OperationResult => {
        try {
          actions.moveClips(clipIds, timeOffset, trackOffset);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Trim clip (adjust in/out points)
       *
       * @param clipId - Clip ID to trim
       * @param trimStart - Amount to trim from start in seconds
       * @param trimEnd - Amount to trim from end in seconds
       * @returns Operation result
       *
       * @example
       * const result = editing.trim('clip-123', 1, 2); // Trim 1s from start, 2s from end
       */
      trim: (clipId: string, trimStart: number, trimEnd: number): OperationResult => {
        try {
          actions.trimClip(clipId, trimStart, trimEnd);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Ripple trim (adjust in/out and shift subsequent clips)
       *
       * @param clipId - Clip ID to trim
       * @param trimStart - Amount to trim from start in seconds
       * @param trimEnd - Amount to trim from end in seconds
       * @returns Operation result
       *
       * @example
       * const result = editing.rippleTrim('clip-123', 0, 2); // Trim 2s from end and ripple
       */
      rippleTrim: (clipId: string, trimStart: number, trimEnd: number): OperationResult => {
        try {
          actions.rippleTrim(clipId, trimStart, trimEnd);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Slip edit (adjust content offset without changing position)
       *
       * @param clipId - Clip ID to slip
       * @param offset - Offset in seconds (positive = later content, negative = earlier)
       * @returns Operation result
       *
       * @example
       * const result = editing.slipEdit('clip-123', 2); // Slip 2 seconds later
       */
      slipEdit: (clipId: string, offset: number): OperationResult => {
        try {
          actions.slipEdit(clipId, offset);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Slide edit (move clip while preserving surrounding gaps)
       *
       * @param clipId - Clip ID to slide
       * @param newStart - New start time in seconds
       * @returns Operation result
       *
       * @example
       * const result = editing.slideEdit('clip-123', 15);
       */
      slideEdit: (clipId: string, newStart: number): OperationResult => {
        try {
          actions.slideEdit(clipId, newStart);
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Undo last operation
       *
       * @returns Operation result
       *
       * @example
       * const result = editing.undo();
       */
      undo: (): OperationResult => {
        try {
          actions.undo();
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Redo previously undone operation
       *
       * @returns Operation result
       *
       * @example
       * const result = editing.redo();
       */
      redo: (): OperationResult => {
        try {
          actions.redo();
          return { success: true, data: undefined };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Check if undo is available
       *
       * @returns True if undo is available
       */
      canUndo: (): boolean => {
        return historyManager.canUndo();
      },

      /**
       * Check if redo is available
       *
       * @returns True if redo is available
       */
      canRedo: (): boolean => {
        return historyManager.canRedo();
      },

      /**
       * Get description of next undo operation
       *
       * @returns Description string or null
       */
      getUndoDescription: (): string | null => {
        return historyManager.getUndoDescription();
      },

      /**
       * Get description of next redo operation
       *
       * @returns Description string or null
       */
      getRedoDescription: (): string | null => {
        return historyManager.getRedoDescription();
      },

      /**
       * Toggle ripple edit mode
       *
       * @example
       * editing.toggleRippleEdit();
       */
      toggleRippleEdit: () => {
        actions.toggleRippleEdit();
      },

      /**
       * Toggle multi-track ripple mode
       *
       * @example
       * editing.toggleMultiTrackRipple();
       */
      toggleMultiTrackRipple: () => {
        actions.toggleMultiTrackRipple();
      },
    }),
    [actions, historyManager]
  );

  /**
   * Selection management methods
   * Select, deselect, and query selected clips
   */
  const selectionMethods = useMemo(
    () => ({
      /**
       * Select clips by IDs
       *
       * @param clipIds - Array of clip IDs to select
       *
       * @example
       * selection.selectClips(['clip-1', 'clip-2', 'clip-3']);
       */
      selectClips: (clipIds: string[]) => {
        actions.setSelection({ clipIds, trackIds: [] });
      },

      /**
       * Select a single clip
       *
       * @param clipId - Clip ID to select
       *
       * @example
       * selection.selectClip('clip-123');
       */
      selectClip: (clipId: string) => {
        actions.setSelection({ clipIds: [clipId], trackIds: [] });
      },

      /**
       * Clear all selections
       *
       * @example
       * selection.clearSelection();
       */
      clearSelection: () => {
        actions.setSelection({ clipIds: [], trackIds: [] });
      },

      /**
       * Get currently selected clip IDs
       *
       * @returns Array of selected clip IDs
       *
       * @example
       * const selected = selection.getSelectedClipIds();
       */
      getSelectedClipIds: (): string[] => {
        return selection.clipIds;
      },

      /**
       * Get currently selected clips (full clip objects)
       *
       * @returns Array of selected clips
       *
       * @example
       * const clips = selection.getSelectedClips();
       */
      getSelectedClips: (): Clip[] => {
        if (!project) return [];

        const sequence = project.sequences[0];
        if (!sequence) return [];

        // Use Set for O(1) lookup instead of O(m) array.includes()
        const selectedSet = new Set(selection.clipIds);
        const selectedClips: Clip[] = [];
        
        for (const track of sequence.tracks) {
          for (const clip of track.clips) {
            if (selectedSet.has(clip.id)) {
              selectedClips.push(clip);
            }
          }
        }

        return selectedClips;
      },

      /**
       * Check if any clips are selected
       *
       * @returns True if any clips are selected
       */
      hasSelection: (): boolean => {
        return selection.clipIds.length > 0;
      },

      /**
       * Check if a specific clip is selected
       *
       * @param clipId - Clip ID to check
       * @returns True if clip is selected
       */
      isClipSelected: (clipId: string): boolean => {
        return selection.clipIds.includes(clipId);
      },
    }),
    [actions, selection, project]
  );

  /**
   * Convenience methods that combine multiple operations
   * High-level operations for common tasks
   */
  const convenience = useMemo(
    () => ({
      /**
       * Delete all currently selected clips
       *
       * @returns Operation result with count of deleted clips
       *
       * @example
       * const result = convenience.deleteSelectedClips();
       * if (result.success) {
       *   console.log(`Deleted ${result.data} clips`);
       * }
       */
      deleteSelectedClips: (): OperationResult<number> => {
        const clipIds = selection.clipIds;

        if (clipIds.length === 0) {
          return {
            success: false,
            error: "No clips selected",
          };
        }

        try {
          actions.deleteClips(clipIds);
          return {
            success: true,
            data: clipIds.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Ripple delete all currently selected clips
       *
       * @returns Operation result with count of deleted clips
       *
       * @example
       * const result = convenience.rippleDeleteSelected();
       */
      rippleDeleteSelected: (): OperationResult<number> => {
        const clipIds = selection.clipIds;

        if (clipIds.length === 0) {
          return {
            success: false,
            error: "No clips selected",
          };
        }

        try {
          // Ripple delete each clip sequentially
          // Note: In the future, we could optimize this with a batch ripple delete
          for (const clipId of clipIds) {
            actions.rippleDelete(clipId);
          }
          return {
            success: true,
            data: clipIds.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Split all selected clips at current playhead position
       *
       * @returns Operation result with count of split clips
       *
       * @example
       * const result = convenience.splitSelectedAtPlayhead();
       * if (result.success) {
       *   console.log(`Split ${result.data} clips`);
       * }
       */
      splitSelectedAtPlayhead: (): OperationResult<number> => {
        const clipIds = selection.clipIds;

        if (clipIds.length === 0) {
          return {
            success: false,
            error: "No clips selected",
          };
        }

        try {
          let splitCount = 0;
          for (const clipId of clipIds) {
            // Find clip to check if playhead is within bounds
            if (!project) continue;

            const sequence = project.sequences[0];
            if (!sequence) continue;

            let targetClip: Clip | undefined;
            for (const track of sequence.tracks) {
              targetClip = track.clips.find((c) => c.id === clipId);
              if (targetClip) break;
            }

            if (!targetClip) continue;

            // Check if playhead is within clip bounds
            const clipEnd = targetClip.start + targetClip.duration;
            if (currentTime > targetClip.start && currentTime < clipEnd) {
              actions.splitAtPlayhead(clipId);
              splitCount++;
            }
          }

          if (splitCount === 0) {
            return {
              success: false,
              error: "Playhead is not within any selected clip bounds",
            };
          }

          return {
            success: true,
            data: splitCount,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      /**
       * Move all selected clips by time offset
       *
       * @param timeOffset - Time offset in seconds
       * @param trackOffset - Optional track offset
       * @returns Operation result with count of moved clips
       *
       * @example
       * const result = convenience.moveSelectedClips(5); // Move 5s forward
       */
      moveSelectedClips: (
        timeOffset: number,
        trackOffset?: number
      ): OperationResult<number> => {
        const clipIds = selection.clipIds;

        if (clipIds.length === 0) {
          return {
            success: false,
            error: "No clips selected",
          };
        }

        try {
          actions.moveClips(clipIds, timeOffset, trackOffset);
          return {
            success: true,
            data: clipIds.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    }),
    [actions, selection, currentTime, project]
  );

  /**
   * State access
   * Read-only access to timeline state
   */
  const state = useMemo(
    () => ({
      /** Current project data */
      project,

      /** Current selection */
      selection,

      /** Current playback time in seconds */
      currentTime,

      /** Whether timeline is playing */
      isPlaying,

      /** Current zoom level */
      zoom: project?.settings.zoom ?? 1,

      /** Whether ripple edit mode is enabled */
      rippleEditEnabled,

      /** Whether multi-track ripple is enabled */
      multiTrackRipple,

      /** Whether editor is ready */
      ready,

      /** Whether there are unsaved changes */
      dirty,

      /** Collision detector instance */
      collisionDetector,

      /** Get active sequence */
      getActiveSequence: () => {
        if (!project?.sequences?.length) return null;
        return project.sequences[0];
      },
    }),
    [
      project,
      selection,
      currentTime,
      isPlaying,
      rippleEditEnabled,
      multiTrackRipple,
      ready,
      dirty,
      collisionDetector,
    ]
  );

  return {
    /** Timeline query methods */
    timeline,

    /** Playback control methods */
    playback,

    /** Editing operation methods */
    editing,

    /** Selection management methods */
    selection: selectionMethods,

    /** Convenience methods combining multiple operations */
    convenience,

    /** State access (read-only) */
    state,

    /** Optional Twick editor API (may be null if not initialized) */
    twickEditor,
  };
};

/**
 * Type helper to extract the return type of useEnhancedTimeline
 * Useful for component props and type annotations
 *
 * @example
 * type Timeline = EnhancedTimelineAPI;
 * const MyComponent = ({ timeline }: { timeline: Timeline }) => { ... };
 */
export type EnhancedTimelineAPI = ReturnType<typeof useEnhancedTimeline>;
