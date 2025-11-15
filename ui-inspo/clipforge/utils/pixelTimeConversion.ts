/**
 * Scale factor for timeline rendering
 * 1 second = 10 pixels
 */
export const PIXELS_PER_SECOND = 10;

/**
 * Convert time in seconds to pixel position on timeline
 * @param time - Time in seconds
 * @returns Pixel position
 */
export const timeToPixels = (time: number): number => {
  return time * PIXELS_PER_SECOND;
};

/**
 * Convert pixel position on timeline to time in seconds
 * @param pixels - Pixel position
 * @returns Time in seconds
 */
export const pixelsToTime = (pixels: number): number => {
  return pixels / PIXELS_PER_SECOND;
};

/**
 * Calculate timeline width based on duration
 * @param duration - Video duration in seconds
 * @returns Timeline width in pixels
 */
export const getTimelineWidth = (duration: number): number => {
  return Math.max(800, timeToPixels(duration)); // Minimum 800px width
};
