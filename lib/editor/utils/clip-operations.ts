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
