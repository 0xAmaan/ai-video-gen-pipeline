"use client";

import { useEffect, useRef } from "react";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { useTimelineContext } from "@twick/timeline";

/**
 * TwickMultiSelectInterceptor Component
 * =======================================
 *
 * Adds multi-clip selection support to Twick's timeline by intercepting DOM clicks.
 *
 * ## Features:
 * - Shift+Click: Range selection between last selected and clicked clip
 * - Cmd/Ctrl+Click: Toggle individual clips in/out of selection
 * - Regular Click: Single selection (Twick default)
 * - Drag-to-select (marquee): Coming soon
 *
 * ## Implementation Strategy:
 * Since Twick's `selectedItem` only supports single selection, we intercept clicks
 * on timeline clip elements at the DOM level and manually manage multi-selection state.
 *
 * Flow:
 * 1. Listen for clicks on Twick timeline container
 * 2. Detect if click target is a clip element (by data attribute or class)
 * 3. Extract clip ID from element
 * 4. Apply multi-selection logic based on modifier keys
 * 5. Update project store selection
 * 6. Add visual styling to selected clips via CSS classes
 */
export const TwickMultiSelectInterceptor = () => {
  const { present } = useTimelineContext();
  const selection = useProjectStore((state) => state.selection);
  const actions = useProjectStore((state) => state.actions);

  // Use refs instead of state to avoid unnecessary re-renders
  const shiftPressedRef = useRef(false);
  const metaPressedRef = useRef(false);
  const selectionRef = useRef(selection);
  const lastClickedRef = useRef<string | null>(null);

  // Keep selection ref in sync
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  // Track modifier key states using refs to avoid re-renders
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = true;
      if (e.key === 'Meta' || e.key === 'Control') metaPressedRef.current = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = false;
      if (e.key === 'Meta' || e.key === 'Control') metaPressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Intercept clicks on Twick timeline elements
  useEffect(() => {
    const handleClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as HTMLElement;

      // Find the closest clip element by traversing up the DOM tree
      // Twick renders timeline elements with data attributes or specific classes
      const clipElement = target.closest('[data-element-id], .timeline-element, [data-track-element-id]');

      // Use refs to get current values without causing re-renders
      const isShiftPressed = shiftPressedRef.current;
      const isMetaPressed = metaPressedRef.current;
      const currentSelection = selectionRef.current;

      if (!clipElement) {
        // Clicked on background - clear selection if no modifiers
        if (!isShiftPressed && !isMetaPressed) {
          actions.setSelection({ clipIds: [], trackIds: [] });
          lastClickedRef.current = null;
        }
        return;
      }

      // Extract clip ID from element
      const clipId =
        clipElement.getAttribute('data-element-id') ||
        clipElement.getAttribute('data-track-element-id') ||
        clipElement.getAttribute('id');

      if (!clipId) return;

      // Apply multi-selection logic
      if (isShiftPressed && lastClickedRef.current && currentSelection.clipIds.length > 0) {
        // Shift+Click: Range selection
        // Get all clip IDs from the timeline in order
        const allClips = getAllClipIdsInOrder(present);
        const lastIndex = allClips.indexOf(lastClickedRef.current);
        const clickedIndex = allClips.indexOf(clipId);

        if (lastIndex !== -1 && clickedIndex !== -1) {
          const startIndex = Math.min(lastIndex, clickedIndex);
          const endIndex = Math.max(lastIndex, clickedIndex);
          const rangeIds = allClips.slice(startIndex, endIndex + 1);

          // Merge with existing selection
          const newSelection = [...new Set([...currentSelection.clipIds, ...rangeIds])];
          actions.setSelection({ clipIds: newSelection, trackIds: [] });
        }
      } else if (isMetaPressed) {
        // Cmd/Ctrl+Click: Toggle selection
        if (currentSelection.clipIds.includes(clipId)) {
          // Remove from selection - keep lastClickedRef unchanged unless selection is empty
          const newSelection = currentSelection.clipIds.filter((id) => id !== clipId);
          actions.setSelection({ clipIds: newSelection, trackIds: [] });
          if (newSelection.length === 0) {
            lastClickedRef.current = null;
          }
          // Don't update lastClickedRef when removing - keep the actual last clicked item
        } else {
          // Add to selection
          actions.setSelection({ clipIds: [...currentSelection.clipIds, clipId], trackIds: [] });
          lastClickedRef.current = clipId;
        }
      } else {
        // Regular click: Single selection
        actions.setSelection({ clipIds: [clipId], trackIds: [] });
        lastClickedRef.current = clipId;
      }
    };

    const container = document.querySelector('#twick-timeline-only');
    if (container) {
      container.addEventListener('click', handleClick, { capture: true });
    }

    return () => {
      // Always cleanup, re-query in case DOM changed
      const container = document.querySelector('#twick-timeline-only');
      if (container) {
        container.removeEventListener('click', handleClick, { capture: true });
      }
    };
  }, [actions, present]); // Stable dependencies only

  // Apply visual styling to multi-selected clips
  useEffect(() => {
    const container = document.querySelector('#twick-timeline-only');

    if (container) {
      // Remove previous multi-select classes
      const previouslySelected = container.querySelectorAll('.multi-selected');
      previouslySelected.forEach((el) => el.classList.remove('multi-selected'));

      // Add multi-select class to currently selected clips
      selection.clipIds.forEach((clipId) => {
        // Fix XSS vulnerability: Escape clipId for ALL selectors
        const escapedId = CSS.escape(clipId);
        const clipElement =
          container.querySelector(`[data-element-id="${escapedId}"]`) ||
          container.querySelector(`[data-track-element-id="${escapedId}"]`) ||
          container.querySelector(`#${escapedId}`);

        if (clipElement) {
          clipElement.classList.add('multi-selected');
        }
      });
    }

    return () => {
      // Cleanup: Remove all multi-selected classes on unmount or selection change
      const container = document.querySelector('#twick-timeline-only');
      if (container) {
        const selected = container.querySelectorAll('.multi-selected');
        selected.forEach((el) => el.classList.remove('multi-selected'));
      }
    };
  }, [selection.clipIds]);

  return (
    <>
      {/* CSS for multi-selected clips */}
      <style jsx global>{`
        .multi-selected {
          outline: 2px solid #3b82f6 !important;
          outline-offset: -2px;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3) !important;
        }

        .multi-selected::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(59, 130, 246, 0.1);
          pointer-events: none;
        }
      `}</style>
    </>
  );
};

/**
 * Helper function to get all clip IDs from the timeline in order
 */
function getAllClipIdsInOrder(present: any): string[] {
  const clipIds: string[] = [];

  if (!present?.tracks) return clipIds;

  // Iterate through all tracks and collect element IDs in order
  for (const track of present.tracks) {
    if (track.elements) {
      for (const element of track.elements) {
        if (element.id) {
          clipIds.push(element.id);
        }
      }
    }
  }

  return clipIds;
}
