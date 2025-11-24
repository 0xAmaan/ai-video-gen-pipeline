/**
 * Pixel conversion utilities hook
 *
 * Converts between time (seconds) and pixel positions on the timeline
 */

import { useMemo } from "react";

export interface UsePixelConversionReturn {
  /** Convert time in seconds to pixel position */
  timeToPixels: (time: number) => number;

  /** Convert pixel position to time in seconds */
  pixelsToTime: (pixels: number) => number;

  /** Calculate clip width in pixels from duration */
  durationToPixels: (duration: number) => number;

  /** Calculate total timeline width in pixels */
  getTimelineWidth: (totalDuration: number) => number;
}

export const usePixelConversion = (
  pixelsPerSecond: number,
): UsePixelConversionReturn => {
  return useMemo(
    () => ({
      /**
       * Convert time to pixels
       * @param time Time in seconds
       * @returns Pixel position
       */
      timeToPixels: (time: number): number => {
        return time * pixelsPerSecond;
      },

      /**
       * Convert pixels to time
       * @param pixels Pixel position
       * @returns Time in seconds
       */
      pixelsToTime: (pixels: number): number => {
        return pixels / pixelsPerSecond;
      },

      /**
       * Convert duration to pixel width
       * @param duration Duration in seconds
       * @returns Width in pixels
       */
      durationToPixels: (duration: number): number => {
        return duration * pixelsPerSecond;
      },

      /**
       * Calculate total timeline width
       * @param totalDuration Total duration in seconds
       * @returns Total width in pixels
       */
      getTimelineWidth: (totalDuration: number): number => {
        // Add extra padding at the end (20% of duration or minimum 500px)
        const padding = Math.max(totalDuration * 0.2 * pixelsPerSecond, 500);
        return totalDuration * pixelsPerSecond + padding;
      },
    }),
    [pixelsPerSecond],
  );
};
