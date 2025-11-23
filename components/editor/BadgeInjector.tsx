"use client";

import { useEffect, useRef } from "react";
import { useTimelineContext } from "@twick/timeline";

// Enable debug logging for badge injection
const DEBUG_BADGES = false;

// Badge data attribute to identify injected badges
const BADGE_DATA_ATTR = "data-track-badge";

/**
 * BadgeInjector Component
 *
 * Injects track type badges (emojis) into Twick timeline clip elements.
 * Shows visual indicators to distinguish video clips from audio clips.
 *
 * Strategy:
 * 1. Access timeline data from useTimelineContext() to get track types
 * 2. Query DOM for .twick-track containers and .twick-track-element divs
 * 3. Match DOM elements to tracks by position
 * 4. Create and inject badge elements with appropriate emoji
 * 5. Re-apply when DOM changes (via MutationObserver)
 *
 * Badge Types:
 * - 🎬 Video clips
 * - 🔊 Narration/SFX audio clips
 * - 🎵 Music audio clips
 */
export const BadgeInjector = () => {
  const { present } = useTimelineContext();
  const appliedVersion = useRef<number>(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!present) return;

    // Create a version signature to avoid redundant applications
    const version = present.version ?? 0;

    // Skip if we've already applied this version
    if (appliedVersion.current === version) {
      return;
    }

    /**
     * Get the appropriate badge emoji for a track
     */
    const getBadgeEmoji = (trackId: string, trackType: string | undefined): string => {
      // Check specific track IDs first
      if (trackId === "video-1") return "🎬";
      if (trackId === "audio-bgm") return "🎵";
      if (trackId === "audio-narration") return "🔊";
      if (trackId === "audio-sfx") return "🔊";
      
      // Fall back to track type
      return trackType === "audio" ? "🔊" : "🎬";
    };

    /**
     * Apply badges to timeline clip elements by matching positions
     */
    const applyBadges = () => {
      if (DEBUG_BADGES) console.log('[BadgeInjector] Applying badges, version:', version);

      // Find the timeline scroll container
      const timelineContainer = document.querySelector('.twick-timeline-scroll-container');
      if (!timelineContainer) {
        if (DEBUG_BADGES) console.warn('[BadgeInjector] Timeline container not found');
        return;
      }

      // Find all track containers
      const trackContainers = timelineContainer.querySelectorAll('.twick-track');

      if (trackContainers.length === 0) {
        if (DEBUG_BADGES) console.warn('[BadgeInjector] No track containers found');
        return;
      }

      if (DEBUG_BADGES) console.log(`[BadgeInjector] Found ${trackContainers.length} tracks, ${present.tracks.length} data tracks`);

      // Process each track
      present.tracks.forEach((track, trackIndex) => {
        const trackContainer = trackContainers[trackIndex];
        if (!trackContainer) {
          if (DEBUG_BADGES) console.warn(`[BadgeInjector] Track container ${trackIndex} not found in DOM`);
          return;
        }

        // Get badge emoji for this track
        const badgeEmoji = getBadgeEmoji(track.id, track.type);

        // Get all track elements in this track
        const elementDivs = Array.from(
          trackContainer.querySelectorAll('.twick-track-element')
        ) as HTMLElement[];

        if (elementDivs.length === 0) {
          if (DEBUG_BADGES) console.log(`[BadgeInjector] No elements in track ${trackIndex}`);
          return;
        }

        if (DEBUG_BADGES) console.log(`[BadgeInjector] Track ${trackIndex} (${track.id}): ${elementDivs.length} clips, badge: ${badgeEmoji}`);

        // Apply badge to each clip in this track
        elementDivs.forEach((div, index) => {
          // Check if badge already exists
          let badge = div.querySelector(`[${BADGE_DATA_ATTR}]`) as HTMLElement;

          if (!badge) {
            // Create new badge element
            badge = document.createElement('div');
            badge.setAttribute(BADGE_DATA_ATTR, 'true');
            
            // Style the badge
            badge.style.position = 'absolute';
            badge.style.top = '2px';
            badge.style.left = '2px';
            badge.style.width = '20px';
            badge.style.height = '20px';
            badge.style.fontSize = '16px';
            badge.style.lineHeight = '20px';
            badge.style.textAlign = 'center';
            badge.style.zIndex = '10';
            badge.style.pointerEvents = 'none';
            badge.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.8), 0 0 4px rgba(0, 0, 0, 0.6)';
            badge.style.userSelect = 'none';
            
            // Insert badge as first child
            div.insertBefore(badge, div.firstChild);
          }

          // Update badge content (in case track type changed)
          badge.textContent = badgeEmoji;

          if (DEBUG_BADGES && index === 0) {
            console.log(`[BadgeInjector] Applied badge "${badgeEmoji}" to first clip in track ${trackIndex}`);
          }
        });
      });

      appliedVersion.current = version;
      if (DEBUG_BADGES) console.log('[BadgeInjector] Badges applied successfully');
    };

    // Apply badges on mount and when data changes
    // Use setTimeout to ensure Twick has finished rendering
    const initialTimer = setTimeout(() => {
      applyBadges();
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

      if (hasTrackChanges) {
        // Debounce to avoid excessive re-applications
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
          if (DEBUG_BADGES) console.log('[BadgeInjector] DOM changed, re-applying badges');
          applyBadges();
        }, 50);
      }
    });

    const timelineElement = document.querySelector('.twick-timeline-scroll-container');
    if (timelineElement) {
      observer.observe(timelineElement, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(initialTimer);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      observer.disconnect();
    };
  }, [present]);

  return null; // This component only injects DOM elements
};
