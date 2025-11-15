import { useState, useCallback } from "react";
import { validateTrimStart, validateTrimEnd } from "../utils/trimValidation";

/**
 * Custom hook for managing trim handle state and logic
 * This is designed to be used by Timeline.tsx (Agent 2's component)
 */
export const useTrimHandles = (
  duration: number,
  initialStart: number = 0,
  initialEnd?: number,
) => {
  const [trimStart, setTrimStart] = useState(initialStart);
  const [trimEnd, setTrimEnd] = useState(initialEnd ?? duration);

  /**
   * Updates trim start with validation
   * Ensures start is always before end and within valid range
   */
  const updateTrimStart = useCallback(
    (newStart: number) => {
      const validStart = validateTrimStart(newStart, trimEnd, duration);
      setTrimStart(validStart);
      return validStart;
    },
    [trimEnd, duration],
  );

  /**
   * Updates trim end with validation
   * Ensures end is always after start and within valid range
   */
  const updateTrimEnd = useCallback(
    (newEnd: number) => {
      const validEnd = validateTrimEnd(newEnd, trimStart, duration);
      setTrimEnd(validEnd);
      return validEnd;
    },
    [trimStart, duration],
  );

  /**
   * Updates both trim points simultaneously
   * Useful for resetting or loading saved trim points
   */
  const updateTrimBoth = useCallback(
    (newStart: number, newEnd: number) => {
      const validStart = validateTrimStart(newStart, newEnd, duration);
      const validEnd = validateTrimEnd(newEnd, validStart, duration);
      setTrimStart(validStart);
      setTrimEnd(validEnd);
      return { start: validStart, end: validEnd };
    },
    [duration],
  );

  /**
   * Resets trim to full video duration
   */
  const resetTrim = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(duration);
  }, [duration]);

  /**
   * Gets the trimmed duration
   */
  const getTrimmedDuration = useCallback(() => {
    return trimEnd - trimStart;
  }, [trimStart, trimEnd]);

  return {
    trimStart,
    trimEnd,
    updateTrimStart,
    updateTrimEnd,
    updateTrimBoth,
    resetTrim,
    getTrimmedDuration,
  };
};
