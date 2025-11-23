import type { Clip, Sequence, Track } from "../types";

/**
 * Gets the clip that should be playing at a given time on the first video track
 */
export const getClipAtTime = (
  sequence: Sequence,
  time: number,
): Clip | null => {
  // Find first video track
  const videoTrack = sequence.tracks.find((track) => track.kind === "video");
  if (!videoTrack) return null;

  const sorted = [...videoTrack.clips].sort((a, b) => a.start - b.start);

  for (const clip of sorted) {
    const clipEnd = clip.start + clip.duration;
    if (time >= clip.start && time < clipEnd) {
      return clip;
    }
  }

  return null;
};

/**
 * Gets the time within the source video for a given timeline time
 */
export const getSourceTimeForTimelineTime = (
  clip: Clip,
  timelineTime: number,
): number => {
  const offsetInClip = timelineTime - clip.start;
  return clip.trimStart + offsetInClip;
};

/**
 * Validates that clips on a track don't overlap (for debugging)
 */
export const validateNoOverlaps = (track: Track): boolean => {
  const sorted = [...track.clips].sort((a, b) => a.start - b.start);

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentClipEnd = sorted[i].start + sorted[i].duration;
    const nextClipStart = sorted[i + 1].start;

    if (currentClipEnd > nextClipStart) {
      console.error("Overlap detected:", {
        clip1: sorted[i],
        clip2: sorted[i + 1],
        overlapAmount: currentClipEnd - nextClipStart,
      });
      return false;
    }
  }

  return true;
};

/**
 * Reflows clips on a track to be sequential without gaps
 */
export const reflowTrackClips = (clips: Clip[]): Clip[] => {
  // Sort by current start position
  const sorted = [...clips].sort((a, b) => a.start - b.start);

  // Reposition each clip sequentially
  let currentTime = 0;
  return sorted.map((clip) => {
    const reflowed = { ...clip, start: currentTime };
    currentTime += clip.duration;
    return reflowed;
  });
};

/**
 * Calculates the total duration of all clips on a track
 */
export const calculateTrackDuration = (clips: Clip[]): number => {
  if (clips.length === 0) return 0;

  const maxEnd = clips.reduce(
    (max, clip) => Math.max(max, clip.start + clip.duration),
    0,
  );
  return maxEnd;
};

/**
 * Splits a clip at the specified timeline time
 * @param clip The clip to split
 * @param splitTime The timeline time at which to split
 * @returns Tuple of [leftClip, rightClip] or null if split is invalid
 */
export const splitClipAtTime = (
  clip: Clip,
  splitTime: number,
): [Clip, Clip] | null => {
  const EPSILON = 0.01; // 10ms tolerance for boundary detection
  const MIN_CLIP_DURATION = 0.1; // Minimum 100ms clip duration

  // Calculate split offset from clip start
  const splitOffset = splitTime - clip.start;

  // Validate split point is within clip
  if (splitOffset < 0 || splitOffset > clip.duration) {
    console.warn("Split time outside clip bounds");
    return null;
  }

  // Don't split if too close to boundaries
  if (splitOffset < EPSILON || splitOffset > clip.duration - EPSILON) {
    console.warn("Split time too close to clip boundary");
    return null;
  }

  // Ensure both resulting clips meet minimum duration
  if (
    splitOffset < MIN_CLIP_DURATION ||
    clip.duration - splitOffset < MIN_CLIP_DURATION
  ) {
    console.warn("Split would create clips that are too short");
    return null;
  }

  // Create left clip (keeps effects/transitions)
  const leftClip: Clip = {
    ...clip,
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    duration: splitOffset,
    trimEnd: clip.trimStart + splitOffset,
  };

  // Create right clip (no effects/transitions)
  const rightClip: Clip = {
    ...clip,
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    start: splitTime,
    duration: clip.duration - splitOffset,
    trimStart: clip.trimStart + splitOffset,
    effects: [],
    transitions: [],
  };

  return [leftClip, rightClip];
};
