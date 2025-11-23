/**
 * Timeline zoom hook
 *
 * Manages zoom level and provides zoom-to-cursor functionality
 * Ported from Legacy timeline with improvements
 */

import { useState, useCallback } from "react";
import { TIMELINE_LAYOUT } from "../types";

export interface UseTimelineZoomReturn {
  /** Current zoom level (0.5x to 4.0x) */
  zoomLevel: number;

  /** Calculated pixels per second */
  pixelsPerSecond: number;

  /** Zoom in (increase magnification) */
  zoomIn: () => void;

  /** Zoom out (decrease magnification) */
  zoomOut: () => void;

  /** Set specific zoom level */
  setZoomLevel: (level: number) => void;

  /** Handle wheel event for zoom-to-cursor */
  handleWheel: (
    e: WheelEvent,
    scrollX: number,
  ) => { newScrollX: number; zoomed: boolean };
}

export const useTimelineZoom = (
  contentDuration?: number,
): UseTimelineZoomReturn => {
  // Calculate smart initial zoom based on content duration
  // Target: make content occupy ~30-40% of a typical viewport (1200px)
  const getInitialZoom = (): number => {
    if (!contentDuration || contentDuration === 0) return 1.0;

    const targetViewportWidth = 1200; // Typical editor viewport width
    const targetContentPercentage = 0.35; // 35% of viewport
    const targetContentWidth = targetViewportWidth * targetContentPercentage;

    // Calculate what zoom would make content fit in target width
    // contentDuration * basePixelsPerSecond * zoom = targetContentWidth
    // zoom = targetContentWidth / (contentDuration * basePixelsPerSecond)
    const calculatedZoom =
      targetContentWidth /
      (contentDuration * TIMELINE_LAYOUT.basePixelsPerSecond);

    // Clamp to reasonable range (0.5x to 4.0x)
    return Math.max(
      TIMELINE_LAYOUT.zoomMin,
      Math.min(TIMELINE_LAYOUT.zoomMax, calculatedZoom),
    );
  };

  const [zoomLevel, setZoomLevelState] = useState(getInitialZoom());

  const pixelsPerSecond = TIMELINE_LAYOUT.basePixelsPerSecond * zoomLevel;

  /**
   * Clamp zoom level to valid range
   */
  const clampZoom = (level: number): number => {
    return Math.max(
      TIMELINE_LAYOUT.zoomMin,
      Math.min(TIMELINE_LAYOUT.zoomMax, level),
    );
  };

  /**
   * Zoom in by one step
   */
  const zoomIn = useCallback(() => {
    setZoomLevelState((prev) => clampZoom(prev + TIMELINE_LAYOUT.zoomStep));
  }, []);

  /**
   * Zoom out by one step
   */
  const zoomOut = useCallback(() => {
    setZoomLevelState((prev) => clampZoom(prev - TIMELINE_LAYOUT.zoomStep));
  }, []);

  /**
   * Set specific zoom level
   */
  const setZoomLevel = useCallback((level: number) => {
    setZoomLevelState(clampZoom(level));
  }, []);

  /**
   * Handle wheel event for zoom-to-cursor
   *
   * Algorithm:
   * 1. Calculate time at cursor position BEFORE zoom
   * 2. Apply zoom
   * 3. Calculate new scroll to keep cursor at same time position
   *
   * This creates smooth "zoom to cursor" behavior like in professional editors
   *
   * @param e Wheel event
   * @param scrollX Current scroll offset
   * @returns New scroll offset and whether zoom occurred
   */
  const handleWheel = useCallback(
    (
      e: WheelEvent,
      scrollX: number,
    ): { newScrollX: number; zoomed: boolean } => {
      // Check if Ctrl/Cmd key is pressed (standard zoom modifier)
      const isZoomModifier = e.ctrlKey || e.metaKey;

      if (!isZoomModifier) {
        return { newScrollX: scrollX, zoomed: false };
      }

      e.preventDefault();

      // Calculate cursor position relative to timeline (accounting for scroll)
      const cursorX = e.offsetX + scrollX;

      // Calculate time at cursor BEFORE zoom
      const timeAtCursor = cursorX / pixelsPerSecond;

      // Determine zoom direction (deltaY negative = zoom in, positive = zoom out)
      const zoomDelta =
        e.deltaY > 0 ? -TIMELINE_LAYOUT.zoomStep : TIMELINE_LAYOUT.zoomStep;

      // Calculate new zoom level
      const newZoomLevel = clampZoom(zoomLevel + zoomDelta);

      // If zoom didn't change (at min/max), don't adjust scroll
      if (newZoomLevel === zoomLevel) {
        return { newScrollX: scrollX, zoomed: false };
      }

      // Apply zoom
      setZoomLevelState(newZoomLevel);

      // Calculate new pixels per second
      const newPixelsPerSecond =
        TIMELINE_LAYOUT.basePixelsPerSecond * newZoomLevel;

      // Calculate new cursor X position (same time, but different pixel position)
      const newCursorX = timeAtCursor * newPixelsPerSecond;

      // Adjust scroll to keep cursor at same screen position
      const newScrollX = newCursorX - e.offsetX;

      return { newScrollX, zoomed: true };
    },
    [zoomLevel, pixelsPerSecond],
  );

  return {
    zoomLevel,
    pixelsPerSecond,
    zoomIn,
    zoomOut,
    setZoomLevel,
    handleWheel,
  };
};
