/**
 * Validation utilities for trim operations
 */

export interface TrimValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates trim start and end times
 * @param start - Trim start time in seconds
 * @param end - Trim end time in seconds
 * @param duration - Total video duration in seconds
 * @returns Validation result with error message if invalid
 */
export const validateTrimTimes = (
  start: number,
  end: number,
  duration: number,
): TrimValidationResult => {
  // Check if times are numbers
  if (isNaN(start) || isNaN(end) || isNaN(duration)) {
    return {
      isValid: false,
      error: "Invalid time values",
    };
  }

  // Check if start is negative
  if (start < 0) {
    return {
      isValid: false,
      error: "Trim start cannot be negative",
    };
  }

  // Check if end exceeds duration
  if (end > duration) {
    return {
      isValid: false,
      error: "Trim end cannot exceed video duration",
    };
  }

  // Check if start is after end
  if (start >= end) {
    return {
      isValid: false,
      error: "Trim start must be before trim end",
    };
  }

  // Check for minimum trim length (0.1 seconds)
  const MIN_TRIM_LENGTH = 0.1;
  if (end - start < MIN_TRIM_LENGTH) {
    return {
      isValid: false,
      error: `Trimmed video must be at least ${MIN_TRIM_LENGTH} seconds long`,
    };
  }

  return { isValid: true };
};

/**
 * Clamps a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Ensures trim start is valid relative to trim end
 * @param newStart - New trim start value
 * @param trimEnd - Current trim end value
 * @param duration - Total video duration
 * @returns Valid trim start value
 */
export const validateTrimStart = (
  newStart: number,
  trimEnd: number,
  duration: number,
): number => {
  // Clamp between 0 and trimEnd (with small buffer)
  const MIN_TRIM_LENGTH = 0.1;
  return clamp(newStart, 0, trimEnd - MIN_TRIM_LENGTH);
};

/**
 * Ensures trim end is valid relative to trim start
 * @param newEnd - New trim end value
 * @param trimStart - Current trim start value
 * @param duration - Total video duration
 * @returns Valid trim end value
 */
export const validateTrimEnd = (
  newEnd: number,
  trimStart: number,
  duration: number,
): number => {
  // Clamp between trimStart and duration (with small buffer)
  const MIN_TRIM_LENGTH = 0.1;
  return clamp(newEnd, trimStart + MIN_TRIM_LENGTH, duration);
};

/**
 * Formats seconds to MM:SS format
 * @param seconds - Time in seconds
 * @returns Formatted time string (MM:SS)
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Generates output filename for trimmed video
 * @param inputPath - Original video file path
 * @returns Suggested output filename
 */
export const generateOutputFilename = (inputPath: string): string => {
  const lastDot = inputPath.lastIndexOf(".");
  const lastSlash = Math.max(
    inputPath.lastIndexOf("/"),
    inputPath.lastIndexOf("\\"),
  );

  if (lastDot > lastSlash) {
    // Has extension - replace with .mp4
    const nameWithoutExt = inputPath.substring(0, lastDot);
    return `${nameWithoutExt}_trimmed.mp4`;
  } else {
    // No extension
    return `${inputPath}_trimmed.mp4`;
  }
};
