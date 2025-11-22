import { useState, useCallback, useEffect, useRef } from 'react';
import type { Clip, MediaAssetMeta } from '../types';

/**
 * Editing modes for timeline clip manipulation
 */
export type EditingMode = 'normal' | 'slip' | 'slide';

/**
 * State for slip/slide editing operations
 */
export interface SlipSlideState {
  mode: EditingMode;
  activeClipId: string | null;
  dragStartX: number | null;
  dragCurrentX: number | null;
  originalClip: Clip | null;
  previewClip: Clip | null;
}

/**
 * Hook for managing slip/slide editing modes in the timeline editor.
 * 
 * **Slip Editing (Alt+drag)**:
 * - Adjusts clip in/out points while keeping timeline position fixed
 * - The clip content "slips" under the fixed timeline position
 * - Useful for adjusting which part of the source media is shown
 * 
 * **Slide Editing (Cmd+Alt+drag)**:
 * - Moves clip while adjusting adjacent clips to preserve gaps
 * - The clip "slides" along the timeline, maintaining spacing
 * - Useful for repositioning clips without creating gaps
 * 
 * **Normal Mode**:
 * - Standard drag behavior (move clip on timeline)
 * 
 * @example
 * ```tsx
 * const { mode, startSlipEdit, startSlideEdit, updateDrag, endEdit, isSlipMode, isSlideMode } = useSlipSlideMode();
 * 
 * const handleMouseDown = (e: MouseEvent, clipId: string) => {
 *   if (e.altKey && e.metaKey) {
 *     startSlideEdit(clipId, e.clientX, clip);
 *   } else if (e.altKey) {
 *     startSlipEdit(clipId, e.clientX, clip);
 *   }
 * };
 * ```
 */
export const useSlipSlideMode = () => {
  const [state, setState] = useState<SlipSlideState>({
    mode: 'normal',
    activeClipId: null,
    dragStartX: null,
    dragCurrentX: null,
    originalClip: null,
    previewClip: null,
  });

  /**
   * Start slip editing mode (Alt+drag)
   * Adjusts in/out points while maintaining timeline position
   */
  const startSlipEdit = useCallback((clipId: string, startX: number, clip: Clip) => {
    setState({
      mode: 'slip',
      activeClipId: clipId,
      dragStartX: startX,
      dragCurrentX: startX,
      originalClip: clip,
      previewClip: { ...clip },
    });
  }, []);

  /**
   * Start slide editing mode (Cmd+Alt+drag)
   * Moves clip while preserving gaps with adjacent clips
   */
  const startSlideEdit = useCallback((clipId: string, startX: number, clip: Clip) => {
    setState({
      mode: 'slide',
      activeClipId: clipId,
      dragStartX: startX,
      dragCurrentX: startX,
      originalClip: clip,
      previewClip: { ...clip },
    });
  }, []);

  /**
   * Update drag position during slip/slide operation
   * 
   * @param currentX - Current mouse X position
   * @param pixelsPerSecond - Timeline zoom factor (pixels per second)
   * @param sourceMediaDuration - Duration of the source media asset
   */
  const updateDrag = useCallback((
    currentX: number, 
    pixelsPerSecond: number,
    sourceMediaDuration: number
  ) => {
    setState(prev => {
      if (!prev.originalClip || prev.dragStartX === null) return prev;

      const deltaX = currentX - prev.dragStartX;
      const deltaTime = deltaX / pixelsPerSecond;

      let updatedClip = { ...prev.originalClip };

      if (prev.mode === 'slip') {
        // Slip mode: adjust trim while keeping timeline position fixed
        const newTrimStart = Math.max(
          0,
          Math.min(
            sourceMediaDuration - prev.originalClip.duration,
            prev.originalClip.trimStart + deltaTime
          )
        );

        updatedClip = {
          ...prev.originalClip,
          trimStart: newTrimStart,
          trimEnd: prev.originalClip.trimEnd - (newTrimStart - prev.originalClip.trimStart),
        };
      } else if (prev.mode === 'slide') {
        // Slide mode: move clip position
        // Note: Gap preservation logic will be handled by the parent component
        const newStart = Math.max(0, prev.originalClip.start + deltaTime);
        
        updatedClip = {
          ...prev.originalClip,
          start: newStart,
        };
      }

      return {
        ...prev,
        dragCurrentX: currentX,
        previewClip: updatedClip,
      };
    });
  }, []);

  /**
   * End slip/slide editing and return to normal mode
   * 
   * @returns The final preview clip state, or null if not in editing mode
   */
  const endEdit = useCallback((): Clip | null => {
    const finalClip = state.previewClip;
    
    setState({
      mode: 'normal',
      activeClipId: null,
      dragStartX: null,
      dragCurrentX: null,
      originalClip: null,
      previewClip: null,
    });

    return finalClip;
  }, [state.previewClip]);

  /**
   * Cancel current editing operation and reset to normal mode
   */
  const cancelEdit = useCallback(() => {
    setState({
      mode: 'normal',
      activeClipId: null,
      dragStartX: null,
      dragCurrentX: null,
      originalClip: null,
      previewClip: null,
    });
  }, []);

  /**
   * Detect modifier keys from mouse/keyboard events to determine editing mode
   * 
   * @param event - Mouse or keyboard event
   * @returns Detected editing mode based on modifier keys
   */
  const detectModeFromModifiers = useCallback((
    event: MouseEvent | KeyboardEvent | React.MouseEvent | React.KeyboardEvent
  ): EditingMode => {
    // Cmd+Alt (or Ctrl+Alt on Windows) = Slide mode
    if ((event.metaKey || event.ctrlKey) && event.altKey) {
      return 'slide';
    }
    // Alt only = Slip mode
    if (event.altKey) {
      return 'slip';
    }
    // No modifiers = Normal mode
    return 'normal';
  }, []);

  /**
   * Calculate slip offset bounds based on source media duration
   * 
   * @param clip - The clip being edited
   * @param sourceMediaDuration - Duration of the source media asset
   * @returns Min and max slip offset values
   */
  const getSlipBounds = useCallback((clip: Clip, sourceMediaDuration: number) => {
    return {
      minSlip: -clip.trimStart,
      maxSlip: sourceMediaDuration - (clip.trimStart + clip.duration + clip.trimEnd),
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.mode !== 'normal') {
        cancelEdit();
      }
    };
  }, [state.mode, cancelEdit]);

  return {
    // State
    mode: state.mode,
    activeClipId: state.activeClipId,
    originalClip: state.originalClip,
    previewClip: state.previewClip,
    isDragging: state.dragStartX !== null,
    
    // Mode checks
    isSlipMode: state.mode === 'slip',
    isSlideMode: state.mode === 'slide',
    isNormalMode: state.mode === 'normal',
    
    // Actions
    startSlipEdit,
    startSlideEdit,
    updateDrag,
    endEdit,
    cancelEdit,
    detectModeFromModifiers,
    getSlipBounds,
  };
};

/**
 * Calculate pixels per second based on timeline zoom and duration
 * 
 * @param zoom - Timeline zoom level (0.1 to 3.0)
 * @param duration - Sequence duration in seconds
 * @param containerWidth - Timeline container width in pixels
 * @returns Pixels per second
 */
export const calculatePixelsPerSecond = (
  zoom: number,
  duration: number,
  containerWidth: number
): number => {
  // Twick's zoom formula: timelineWidth = duration * zoom * 100
  const timelineWidth = duration * zoom * 100;
  return timelineWidth / duration;
};

/**
 * Get cursor style for the current editing mode
 * 
 * @param mode - Current editing mode
 * @returns CSS cursor value
 */
export const getCursorForMode = (mode: EditingMode): string => {
  switch (mode) {
    case 'slip':
      return 'col-resize';
    case 'slide':
      return 'grab';
    case 'normal':
    default:
      return 'default';
  }
};
