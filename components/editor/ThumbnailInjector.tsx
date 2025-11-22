"use client";

import { useEffect, useRef } from "react";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { useTimelineContext } from "@twick/timeline";

// Enable debug logging for thumbnail injection
const DEBUG_THUMBNAILS = false;

/**
 * ThumbnailInjector Component (Position-Based Direct Styling)
 *
 * Applies video thumbnails to Twick timeline elements using direct DOM manipulation.
 * Uses position-based matching since Twick doesn't expose element IDs in the DOM.
 *
 * Strategy:
 * 1. Access timeline data from useTimelineContext() to get element order
 * 2. Query DOM for .twick-track containers and .twick-track-element divs
 * 3. Match DOM elements to timeline elements by position (sorted by start time and left position)
 * 4. Apply thumbnails via inline backgroundImage styles
 * 5. Re-apply when DOM changes (via MutationObserver)
 *
 * This approach bypasses the need for data attributes and works with Twick's rendering.
 */
export const ThumbnailInjector = () => {
  const project = useProjectStore((state) => state.project);
  const { present } = useTimelineContext();
  const appliedVersion = useRef<number>(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!project || !present) return;

    // Create a version signature to avoid redundant applications
    const version = present.version ?? 0;

    // Skip if we've already applied this version
    if (appliedVersion.current === version) {
      return;
    }

    /**
     * Apply thumbnails to timeline elements by matching positions
     */
    const applyThumbnails = () => {
      if (DEBUG_THUMBNAILS) console.log('[ThumbnailInjector] Applying thumbnails, version:', version);

      // Find the timeline scroll container
      const timelineContainer = document.querySelector('.twick-timeline-scroll-container');
      if (!timelineContainer) {
        if (DEBUG_THUMBNAILS) console.warn('[ThumbnailInjector] Timeline container not found');
        return;
      }

      // Find all track containers
      const trackContainers = timelineContainer.querySelectorAll('.twick-track');

      if (trackContainers.length === 0) {
        if (DEBUG_THUMBNAILS) console.warn('[ThumbnailInjector] No track containers found');
        return;
      }

      if (DEBUG_THUMBNAILS) console.log(`[ThumbnailInjector] Found ${trackContainers.length} tracks, ${present.tracks.length} data tracks`);

      // Process each track
      present.tracks.forEach((track, trackIndex) => {
        const trackContainer = trackContainers[trackIndex];
        if (!trackContainer) {
          if (DEBUG_THUMBNAILS) console.warn(`[ThumbnailInjector] Track container ${trackIndex} not found in DOM`);
          return;
        }

        // Get all track elements in this track
        const elementDivs = Array.from(
          trackContainer.querySelectorAll('.twick-track-element')
        ) as HTMLElement[];

        if (elementDivs.length === 0) {
          if (DEBUG_THUMBNAILS) console.log(`[ThumbnailInjector] No elements in track ${trackIndex}`);
          return;
        }

        // Sort DOM elements by left position (visual order)
        const sortedDivs = elementDivs.sort((a, b) => {
          const leftA = parseFloat(a.style.left || '0');
          const leftB = parseFloat(b.style.left || '0');
          return leftA - leftB;
        });

        // Sort timeline elements by start time
        const sortedElements = [...track.elements].sort((a, b) => a.s - b.s);

        if (DEBUG_THUMBNAILS) console.log(`[ThumbnailInjector] Track ${trackIndex}: ${sortedDivs.length} DOM elements, ${sortedElements.length} data elements`);

        // Match by position and apply thumbnails
        sortedDivs.forEach((div, index) => {
          const element = sortedElements[index];
          if (!element) {
            if (DEBUG_THUMBNAILS) console.warn(`[ThumbnailInjector] No data element at index ${index}`);
            return;
          }

          // Access thumbnails from element props
          const thumbnails = (element as any).props?.thumbnails;

          if (!thumbnails || !Array.isArray(thumbnails) || thumbnails.length === 0) {
            // Clear any existing thumbnail backgrounds
            div.style.backgroundImage = '';
            return;
          }

          // Apply thumbnail background
          const thumbnailUrls = thumbnails.map((t: string) => `url("${t}")`).join(', ');

          if (DEBUG_THUMBNAILS) console.log(`[ThumbnailInjector] Applying ${thumbnails.length} thumbnails to element ${index}`);

          div.style.backgroundImage = thumbnailUrls;
          div.style.backgroundSize = 'auto 100%';
          div.style.backgroundRepeat = 'repeat-x';
          div.style.backgroundPosition = 'left center';
          div.style.opacity = '0.9';

          // Ensure content (text label) appears above background
          const content = div.querySelector('.twick-track-element-content') as HTMLElement;
          if (content) {
            content.style.position = 'relative';
            content.style.zIndex = '1';
            content.style.color = 'white';
            content.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.8)';
          }

          // Dim thumbnails when element is selected for better text visibility
          if (div.classList.contains('twick-track-element-selected')) {
            div.style.opacity = '0.6';
          }
        });
      });

      appliedVersion.current = version;
      if (DEBUG_THUMBNAILS) console.log('[ThumbnailInjector] Thumbnails applied successfully');
    };

    // Apply thumbnails on mount and when data changes
    // Use setTimeout to ensure Twick has finished rendering
    const initialTimer = setTimeout(() => {
      applyThumbnails();
    }, 100);

    // Set up MutationObserver to re-apply when DOM changes
    const observer = new MutationObserver((mutations) => {
      const hasTrackChanges = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            ((node as Element).classList?.contains('twick-track-element') ||
              (node as Element).querySelector?.('.twick-track-element'))
        )
      );

      const hasClassChanges = mutations.some(
        (m) => m.type === 'attributes' && m.attributeName === 'class'
      );

      if (hasTrackChanges || hasClassChanges) {
        // Debounce to avoid excessive re-runs during rapid changes
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
          // Only re-apply if version hasn't already been applied
          if (appliedVersion.current !== version) {
            if (DEBUG_THUMBNAILS) console.log('[ThumbnailInjector] DOM changed, re-applying thumbnails');
            applyThumbnails();
          }
        }, 100); // Increased debounce time from 50ms to 100ms
      }
    });

    const timelineContainer = document.querySelector('.twick-timeline-scroll-container');
    if (timelineContainer) {
      observer.observe(timelineContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'], // Watch for selection state changes
      });
    }

    // Cleanup
    return () => {
      clearTimeout(initialTimer);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      observer.disconnect();
    };
  }, [project, present]);

  // This is a utility component that doesn't render anything
  return null;
};
