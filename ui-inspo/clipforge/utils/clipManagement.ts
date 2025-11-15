import { v4 as uuidv4 } from "uuid";
import type { Clip, VideoMetadata } from "../types";

/**
 * Snap threshold in seconds - clips will snap to each other within this distance
 */
const SNAP_THRESHOLD = 0.1;

/**
 * Creates a new clip object
 */
export const createClip = (
  sourceFilePath: string,
  sourceMetadata: VideoMetadata,
  timelineStart: number = 0,
): Clip => {
  const duration = sourceMetadata.duration;
  return {
    id: uuidv4(),
    sourceFilePath,
    sourceStart: 0,
    sourceEnd: duration,
    timelineStart,
    duration,
    sourceMetadata,
  };
};

/**
 * Adds a clip to the timeline at the end
 */
export const addClip = (clips: Clip[], newClip: Clip): Clip[] => {
  const totalDuration = calculateTotalDuration(clips);
  return [...clips, { ...newClip, timelineStart: totalDuration }];
};

/**
 * Removes a clip from the timeline and reflows remaining clips
 */
export const removeClip = (clips: Clip[], clipId: string): Clip[] => {
  const filtered = clips.filter((clip) => clip.id !== clipId);
  return reflowClips(filtered);
};

/**
 * Updates a clip's trim points and recalculates duration
 */
export const updateClipTrim = (
  clips: Clip[],
  clipId: string,
  newSourceStart: number,
  newSourceEnd: number,
): Clip[] => {
  return clips.map((clip) => {
    if (clip.id === clipId) {
      const newDuration = newSourceEnd - newSourceStart;
      return {
        ...clip,
        sourceStart: newSourceStart,
        sourceEnd: newSourceEnd,
        duration: newDuration,
      };
    }
    return clip;
  });
};

/**
 * Moves a clip to a new position on the timeline with snap-to-prevent-overlap
 */
export const moveClip = (
  clips: Clip[],
  clipId: string,
  newTimelineStart: number,
): Clip[] => {
  const clipIndex = clips.findIndex((c) => c.id === clipId);
  if (clipIndex === -1) return clips;

  const clip = clips[clipIndex];
  const otherClips = clips.filter((c) => c.id !== clipId);

  // Find snap position
  const snappedStart = findSnapPosition(
    newTimelineStart,
    clip.duration,
    otherClips,
  );

  // Create reordered array
  const updatedClip = { ...clip, timelineStart: snappedStart };
  const newClips = [...otherClips, updatedClip];

  // Sort by timeline position
  newClips.sort((a, b) => a.timelineStart - b.timelineStart);

  // Reflow to prevent overlaps
  return reflowClips(newClips);
};

/**
 * Finds the nearest snap position to prevent overlaps
 */
const findSnapPosition = (
  desiredStart: number,
  clipDuration: number,
  otherClips: Clip[],
): number => {
  // Constrain to timeline start
  let snapStart = Math.max(0, desiredStart);

  // Find snap points (start and end of other clips)
  const snapPoints: number[] = [0];
  otherClips.forEach((clip) => {
    snapPoints.push(clip.timelineStart);
    snapPoints.push(clip.timelineStart + clip.duration);
  });

  // Find closest snap point
  let closestSnap = snapStart;
  let minDistance = SNAP_THRESHOLD + 1;

  snapPoints.forEach((point) => {
    const distance = Math.abs(snapStart - point);
    if (distance < minDistance && distance < SNAP_THRESHOLD) {
      closestSnap = point;
      minDistance = distance;
    }
  });

  return closestSnap;
};

/**
 * Reflows clips to be sequential without gaps or overlaps
 */
export const reflowClips = (clips: Clip[]): Clip[] => {
  // Sort by current timeline position
  const sorted = [...clips].sort((a, b) => a.timelineStart - b.timelineStart);

  // Reposition each clip sequentially
  let currentTime = 0;
  return sorted.map((clip) => {
    const reflowed = { ...clip, timelineStart: currentTime };
    currentTime += clip.duration;
    return reflowed;
  });
};

/**
 * Calculates the total duration of all clips
 */
export const calculateTotalDuration = (clips: Clip[]): number => {
  return clips.reduce((total, clip) => total + clip.duration, 0);
};

/**
 * Gets the clip that should be playing at a given time
 */
export const getClipAtTime = (clips: Clip[], time: number): Clip | null => {
  const sorted = [...clips].sort((a, b) => a.timelineStart - b.timelineStart);

  for (const clip of sorted) {
    const clipEnd = clip.timelineStart + clip.duration;
    if (time >= clip.timelineStart && time < clipEnd) {
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
  const offsetInClip = timelineTime - clip.timelineStart;
  return clip.sourceStart + offsetInClip;
};

/**
 * Splits a clip at a given timeline time into two clips
 * Returns updated clips array with the split clips
 */
export const splitClip = (
  clips: Clip[],
  timelineTime: number,
): Clip[] | null => {
  // Find the clip at the given timeline time
  const clipToSplit = getClipAtTime(clips, timelineTime);

  if (!clipToSplit) {
    console.warn("No clip found at timeline time:", timelineTime);
    return null;
  }

  // Calculate the split point in source time
  const splitSourceTime = getSourceTimeForTimelineTime(
    clipToSplit,
    timelineTime,
  );

  // Don't split if we're too close to the beginning or end (within 0.1 seconds)
  const minSplitDistance = 0.1;
  if (
    splitSourceTime - clipToSplit.sourceStart < minSplitDistance ||
    clipToSplit.sourceEnd - splitSourceTime < minSplitDistance
  ) {
    console.warn("Split point too close to clip boundary");
    return null;
  }

  // Create the first clip (before split point)
  const firstClip: Clip = {
    ...clipToSplit,
    id: uuidv4(), // New ID for first clip
    sourceEnd: splitSourceTime,
    duration: splitSourceTime - clipToSplit.sourceStart,
    thumbnails: undefined, // Clear thumbnails, they'll be regenerated if needed
    thumbnailsLoading: false,
  };

  // Create the second clip (after split point)
  const secondClip: Clip = {
    ...clipToSplit,
    id: uuidv4(), // New ID for second clip
    sourceStart: splitSourceTime,
    duration: clipToSplit.sourceEnd - splitSourceTime,
    timelineStart: clipToSplit.timelineStart + firstClip.duration,
    thumbnails: undefined, // Clear thumbnails, they'll be regenerated if needed
    thumbnailsLoading: false,
  };

  // Replace the original clip with the two new clips
  const updatedClips = clips
    .map((clip) => {
      if (clip.id === clipToSplit.id) {
        // Return both clips in place of the original
        return [firstClip, secondClip];
      }
      return clip;
    })
    .flat();

  // Reflow to ensure proper positioning
  return reflowClips(updatedClips);
};

/**
 * Validates that clips don't overlap (for debugging)
 */
export const validateNoOverlaps = (clips: Clip[]): boolean => {
  const sorted = [...clips].sort((a, b) => a.timelineStart - b.timelineStart);

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentClipEnd = sorted[i].timelineStart + sorted[i].duration;
    const nextClipStart = sorted[i + 1].timelineStart;

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
