"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { useTimelineContext } from "@twick/timeline";
import { useSlipSlideMode, calculatePixelsPerSecond } from "@/lib/editor/hooks/useSlipSlideMode";
import type { Clip } from "@/lib/editor/types";

/**
 * SlipSlideDragInterceptor Component
 *
 * Intercepts drag events on Twick timeline elements to enable slip/slide editing modes.
 *
 * Strategy:
 * 1. Monitor timeline DOM for .twick-track-element divs
 * 2. Attach mousedown/mousemove/mouseup listeners to detect drag with modifiers
 * 3. When Alt or Cmd+Alt is held during drag:
 *    - Prevent Twick's default drag behavior
 *    - Call slip/slide hook functions to handle the operation
 *    - Apply changes via project store actions
 *
 * Modifier Keys:
 * - Alt+drag → Slip mode (adjust content offset, keep timeline position)
 * - Cmd+Alt+drag (Mac) / Ctrl+Alt+drag (Windows) → Slide mode (move with gap preservation)
 */
export const SlipSlideDragInterceptor = () => {
  const project = useProjectStore((state) => state.project);
  const actions = useProjectStore((state) => state.actions);
  const { present } = useTimelineContext();

  const {
    mode,
    startSlipEdit,
    startSlideEdit,
    updateDrag,
    endEdit,
    cancelEdit,
    detectModeFromModifiers,
  } = useSlipSlideMode();

  const isDraggingRef = useRef(false);
  const draggedClipIdRef = useRef<string | null>(null);
  const startXRef = useRef(0);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [zoom, setZoom] = useState(1.5);

  // Detect timeline zoom and container width from DOM
  useEffect(() => {
    const detectDimensions = () => {
      const container = document.querySelector('#twick-timeline-only');
      if (container) {
        const width = container.clientWidth;
        setContainerWidth(width);
      }

      const grid = document.querySelector('.twick-timeline-grid-wrapper') as HTMLElement;
      if (grid) {
        const transform = grid.style.transform;
        const match = transform?.match(/scaleX\(([\d.]+)\)/);
        if (match) {
          setZoom(parseFloat(match[1]));
        }
      }
    };

    detectDimensions();
    const interval = setInterval(detectDimensions, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!project || !present) return;

    let cleanupFunctions: (() => void)[] = [];

    const attachDragListeners = () => {
      const timelineContainer = document.querySelector('.twick-timeline-scroll-container');
      if (!timelineContainer) return;

      const trackElements = timelineContainer.querySelectorAll('.twick-track-element');

      trackElements.forEach((element, index) => {
        const htmlElement = element as HTMLElement;

        // Match DOM element to timeline data by position
        const leftPos = parseFloat(htmlElement.style.left || '0');

        // Find corresponding clip in project data
        const sequence = project.sequences[0];
        if (!sequence) return;

        // Get all clips sorted by start time
        const allClips: Clip[] = [];
        sequence.tracks.forEach(track => {
          allClips.push(...track.clips);
        });
        allClips.sort((a, b) => a.start - b.start);

        const clip = allClips[index];
        if (!clip) return;

        const handleMouseDown = (e: MouseEvent) => {
          // Detect if modifier keys are pressed
          const editMode = detectModeFromModifiers(e);

          if (editMode === 'normal') {
            // No modifiers, let Twick handle normal drag
            return;
          }

          // Prevent Twick's default drag behavior
          e.stopPropagation();
          e.preventDefault();

          isDraggingRef.current = true;
          draggedClipIdRef.current = clip.id;
          startXRef.current = e.clientX;

          // Start slip or slide mode
          if (editMode === 'slip') {
            startSlipEdit(clip.id, e.clientX, clip);
          } else if (editMode === 'slide') {
            startSlideEdit(clip.id, e.clientX, clip);
          }
        };

        htmlElement.addEventListener('mousedown', handleMouseDown, { capture: false });

        cleanupFunctions.push(() => {
          htmlElement.removeEventListener('mousedown', handleMouseDown, { capture: false });
        });
      });
    };

    // Global mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !draggedClipIdRef.current) return;

      // Find the clip being dragged to get source media duration
      const sequence = project.sequences[0];
      if (!sequence) return;

      const allClips: Clip[] = [];
      sequence.tracks.forEach(track => {
        allClips.push(...track.clips);
      });

      const clip = allClips.find(c => c.id === draggedClipIdRef.current);
      if (!clip) return;

      const asset = Object.values(project.mediaAssets).find(a => a.id === clip.mediaId);
      const sourceMediaDuration = asset?.duration ?? 60; // Default 60s if not found

      // Calculate pixels per second from zoom and container width
      const pixelsPerSecond = calculatePixelsPerSecond(containerWidth, zoom, sequence.duration);

      updateDrag(e.clientX, pixelsPerSecond, sourceMediaDuration);
    };

    // Global mouse up handler
    const handleMouseUp = async (e: MouseEvent) => {
      if (!isDraggingRef.current || !draggedClipIdRef.current) return;

      const clipId = draggedClipIdRef.current;
      const finalClip = endEdit();

      if (finalClip && mode === 'slip') {
        // Apply slip edit: calculate offset from original trim
        const sequence = project.sequences[0];
        if (!sequence) return;

        const allClips: Clip[] = [];
        sequence.tracks.forEach(track => {
          allClips.push(...track.clips);
        });

        const originalClip = allClips.find(c => c.id === clipId);
        if (originalClip) {
          const offset = finalClip.trimStart - originalClip.trimStart;
          actions.slipEdit(clipId, offset);
        }
      } else if (finalClip && mode === 'slide') {
        // Apply slide edit with new start position
        actions.slideEdit(clipId, finalClip.start);
      }

      // Reset state
      isDraggingRef.current = false;
      draggedClipIdRef.current = null;
    };

    // Attach listeners with delay to ensure Twick has rendered
    const timer = setTimeout(() => {
      attachDragListeners();
    }, 200);

    // Attach global mouse handlers
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Re-attach when DOM changes
    const observer = new MutationObserver((mutations) => {
      const hasTrackChanges = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            ((node as Element).classList?.contains('twick-track-element') ||
              (node as Element).querySelector?.('.twick-track-element'))
        )
      );

      if (hasTrackChanges) {
        // Clean up old listeners
        cleanupFunctions.forEach(cleanup => cleanup());
        cleanupFunctions = [];

        // Re-attach with debounce
        setTimeout(() => {
          attachDragListeners();
        }, 100);
      }
    });

    const timelineContainer = document.querySelector('.twick-timeline-scroll-container');
    if (timelineContainer) {
      observer.observe(timelineContainer, {
        childList: true,
        subtree: true,
      });
    }

    // Cleanup
    return () => {
      clearTimeout(timer);
      cleanupFunctions.forEach(cleanup => cleanup());
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      observer.disconnect();
    };
  }, [project, present, mode, startSlipEdit, startSlideEdit, updateDrag, endEdit, detectModeFromModifiers, actions]);

  // Handle Escape key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingRef.current) {
        cancelEdit();
        isDraggingRef.current = false;
        draggedClipIdRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelEdit]);

  return null;
};
