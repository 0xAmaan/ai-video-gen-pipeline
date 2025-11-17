import type { SpeedCurve, SpeedKeyframe } from "../types";

/**
 * Cubic Bezier easing function
 * Provides smooth interpolation between two values using a cubic curve
 *
 * @param t - Progress value between 0 and 1
 * @param p0 - Starting value
 * @param p1 - First control point
 * @param p2 - Second control point
 * @param p3 - Ending value
 * @returns Interpolated value
 */
export const cubicBezier = (
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): number => {
  const u = 1 - t;
  return (
    u * u * u * p0 +
    3 * u * u * t * p1 +
    3 * u * t * t * p2 +
    t * t * t * p3
  );
};

/**
 * Easing function type definition
 */
export type EasingFunction = (t: number) => number;

/**
 * Standard easing curves
 */
export const easingFunctions: Record<string, EasingFunction> = {
  linear: (t: number) => t,

  // Ease in (slow start, accelerate)
  easeIn: (t: number) => t * t,
  easeInCubic: (t: number) => t * t * t,

  // Ease out (fast start, decelerate)
  easeOut: (t: number) => 1 - Math.pow(1 - t, 2),
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),

  // Ease in-out (slow start and end)
  easeInOut: (t: number) => {
    if (t < 0.5) {
      return 2 * t * t;
    } else {
      return 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
  },
  easeInOutCubic: (t: number) => {
    if (t < 0.5) {
      return 4 * t * t * t;
    } else {
      return 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
  },

  // Smooth (similar to CSS ease)
  smooth: (t: number) => {
    // Using cubic bezier approximation of CSS "ease" (0.25, 0.1, 0.25, 1.0)
    return cubicBezier(t, 0, 0.25, 0.75, 1);
  },
};

/**
 * Calculate speed at a given normalized time using cubic interpolation
 *
 * @param speedCurve - The speed curve containing keyframes
 * @param normalizedTime - Time value between 0 and 1 (0 = start of clip, 1 = end of clip)
 * @param easing - Optional easing function name (defaults to 'easeInOutCubic' for smooth transitions)
 * @returns Speed multiplier at the given time
 */
export const calculateSpeedAtTime = (
  speedCurve: SpeedCurve | null,
  normalizedTime: number,
  easing: keyof typeof easingFunctions = "easeInOutCubic",
): number => {
  // Edge case: no speed curve means normal 1x speed
  if (!speedCurve || speedCurve.keyframes.length === 0) {
    return 1.0;
  }

  const keyframes = [...speedCurve.keyframes].sort((a, b) => a.time - b.time);

  // Edge case: single keyframe
  if (keyframes.length === 1) {
    return keyframes[0].speed;
  }

  // Clamp time to 0-1 range
  const t = Math.max(0, Math.min(1, normalizedTime));

  // Find the two keyframes that surround our time value
  let leftIndex = 0;
  let rightIndex = keyframes.length - 1;

  // If before first keyframe, return first speed
  if (t <= keyframes[0].time) {
    return keyframes[0].speed;
  }

  // If after last keyframe, return last speed
  if (t >= keyframes[keyframes.length - 1].time) {
    return keyframes[keyframes.length - 1].speed;
  }

  // Binary search for the surrounding keyframes (more efficient for many keyframes)
  while (rightIndex - leftIndex > 1) {
    const mid = Math.floor((leftIndex + rightIndex) / 2);
    if (keyframes[mid].time <= t) {
      leftIndex = mid;
    } else {
      rightIndex = mid;
    }
  }

  const k0 = keyframes[leftIndex];
  const k1 = keyframes[rightIndex];

  // Calculate progress between the two keyframes (0-1)
  const segmentProgress = (t - k0.time) / (k1.time - k0.time);

  // Apply easing function to the progress
  const easingFn = easingFunctions[easing] || easingFunctions.easeInOutCubic;
  const easedProgress = easingFn(segmentProgress);

  // Interpolate speed using the eased progress
  return k0.speed + (k1.speed - k0.speed) * easedProgress;
};

/**
 * Sample the speed curve at multiple points to generate a smooth visualization
 *
 * @param speedCurve - The speed curve to sample
 * @param numSamples - Number of sample points to generate (default: 100)
 * @param easing - Easing function to use
 * @returns Array of {time, speed} points suitable for rendering
 */
export const sampleSpeedCurve = (
  speedCurve: SpeedCurve | null,
  numSamples: number = 100,
  easing: keyof typeof easingFunctions = "easeInOutCubic",
): Array<{ time: number; speed: number }> => {
  const samples: Array<{ time: number; speed: number }> = [];

  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const speed = calculateSpeedAtTime(speedCurve, t, easing);
    samples.push({ time: t, speed });
  }

  return samples;
};

/**
 * Calculate the effective duration of a clip after applying speed curve
 * This is used to determine the actual playback time considering variable speed
 *
 * @param originalDuration - Original clip duration in seconds
 * @param speedCurve - Speed curve to apply
 * @param numSamples - Number of samples for numerical integration (default: 1000)
 * @returns Effective duration in seconds
 */
export const calculateEffectiveDuration = (
  originalDuration: number,
  speedCurve: SpeedCurve | null,
  numSamples: number = 1000,
): number => {
  if (!speedCurve || speedCurve.keyframes.length === 0) {
    return originalDuration;
  }

  // Numerical integration using trapezoidal rule
  // Each segment of the clip takes time = segmentLength / speed
  let effectiveDuration = 0;
  const dt = 1 / numSamples; // Normalized time step

  for (let i = 0; i < numSamples; i++) {
    const t1 = i / numSamples;
    const t2 = (i + 1) / numSamples;
    const speed1 = calculateSpeedAtTime(speedCurve, t1);
    const speed2 = calculateSpeedAtTime(speedCurve, t2);

    // Average speed in this segment
    const avgSpeed = (speed1 + speed2) / 2;

    // Avoid division by zero for freeze frames
    if (avgSpeed > 0.001) {
      // Time taken for this segment at the average speed
      effectiveDuration += dt / avgSpeed;
    } else {
      // Freeze frame: this segment takes infinite time (we'll cap it)
      effectiveDuration += dt / 0.001;
    }
  }

  return effectiveDuration * originalDuration;
};

/**
 * Get the source frame position for a given playback time with speed curve applied
 * This is the inverse of speed curve application - given a playback time, find which
 * source frame should be displayed
 *
 * @param playbackTime - Time in the playback (affected by speed)
 * @param originalDuration - Original clip duration
 * @param speedCurve - Speed curve to apply
 * @returns Normalized source position (0-1) in the original clip
 */
export const getSourcePositionForPlayback = (
  playbackTime: number,
  originalDuration: number,
  speedCurve: SpeedCurve | null,
): number => {
  if (!speedCurve || speedCurve.keyframes.length === 0) {
    return playbackTime / originalDuration;
  }

  // Numerical integration to find source position
  // We integrate the speed curve from 0 to find when we reach playbackTime
  const numSteps = 1000;
  let currentSourcePos = 0;
  let accumulatedTime = 0;

  for (let i = 0; i < numSteps && accumulatedTime < playbackTime; i++) {
    const sourcePos = i / numSteps;
    const speed = calculateSpeedAtTime(speedCurve, sourcePos);
    const dt = originalDuration / numSteps;

    // At this speed, how much time does this segment take?
    const segmentTime = speed > 0.001 ? dt / speed : dt / 0.001;
    accumulatedTime += segmentTime;
    currentSourcePos = sourcePos;
  }

  return Math.min(1, currentSourcePos);
};
