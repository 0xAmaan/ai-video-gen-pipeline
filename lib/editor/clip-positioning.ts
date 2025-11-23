import type { Clip } from "./types";

/**
 * Snap threshold in pixels - how close clips need to be to snap together
 */
export const SNAP_THRESHOLD_PIXELS = 8;

/**
 * Snap threshold in seconds (calculated from pixels and zoom)
 */
export const calculateSnapThreshold = (pixelsPerSecond: number): number => {
  return SNAP_THRESHOLD_PIXELS / pixelsPerSecond;
};

/**
 * Find all snap points for a clip being dragged
 */
export const findSnapPoints = (
  draggedClip: Clip,
  allClips: Clip[],
  currentTime: number,
): number[] => {
  const snapPoints: number[] = [0, currentTime]; // Timeline start and playhead

  allClips.forEach((clip) => {
    if (clip.id === draggedClip.id) return;

    // Add start and end points of other clips
    snapPoints.push(clip.start);
    snapPoints.push(clip.start + clip.duration);
  });

  return snapPoints;
};

/**
 * Check if a position should snap to any nearby snap points
 * Returns the snapped position or the original position if no snap
 */
export const checkSnap = (
  position: number,
  snapPoints: number[],
  snapThreshold: number,
): { snapped: boolean; position: number; snapPoint: number | null } => {
  for (const snapPoint of snapPoints) {
    const distance = Math.abs(position - snapPoint);
    if (distance <= snapThreshold) {
      return { snapped: true, position: snapPoint, snapPoint };
    }
  }

  return { snapped: false, position, snapPoint: null };
};

/**
 * Get the drop slot index based on the drag position
 * Returns which position (0, 1, 2, etc.) the clip should occupy
 */
export const getDropSlotIndex = (
  dragPosition: number,
  draggedClipId: string,
  allClips: Clip[],
): number => {
  // Sort clips by start position (excluding the dragged clip)
  const otherClips = allClips
    .filter((c) => c.id !== draggedClipId)
    .sort((a, b) => a.start - b.start);

  // If no other clips, drop at position 0
  if (otherClips.length === 0) return 0;

  // Find which slot based on midpoint between clips
  for (let i = 0; i < otherClips.length; i++) {
    const clip = otherClips[i];
    const clipMidpoint = clip.start + clip.duration / 2;

    // If drag position is before this clip's midpoint, insert before it
    if (dragPosition < clipMidpoint) {
      return i;
    }
  }

  // If we got here, drop at the end
  return otherClips.length;
};

/**
 * Calculate new positions for all clips when one is dragged with swap/reorder behavior
 * Clips swap positions based on which slot the dragged clip is dropped into
 */
export const calculateClipSwap = (
  draggedClipId: string,
  newStart: number,
  trackId: string,
  allClips: Clip[],
): { clipId: string; newStart: number; newOrder: number }[] => {
  // Find the dragged clip
  const draggedClip = allClips.find((c) => c.id === draggedClipId);
  if (!draggedClip) return [];

  // Get all clips on this track, sorted by start position
  const trackClips = allClips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start);

  // Find current index of dragged clip
  const currentIndex = trackClips.findIndex((c) => c.id === draggedClipId);
  if (currentIndex === -1) return [];

  // Calculate which slot (index) the clip should drop into
  const targetIndex = getDropSlotIndex(newStart, draggedClipId, trackClips);

  // If dropping in same position, no change needed
  if (currentIndex === targetIndex) {
    return [];
  }

  // Create new order array by moving the clip
  const newOrder = [...trackClips];
  const [movedClip] = newOrder.splice(currentIndex, 1);
  newOrder.splice(targetIndex, 0, movedClip);

  // Calculate new positions (stacked horizontally)
  const updates: { clipId: string; newStart: number; newOrder: number }[] = [];
  let position = 0;

  newOrder.forEach((clip, index) => {
    updates.push({
      clipId: clip.id,
      newStart: position,
      newOrder: index,
    });
    position += clip.duration;
  });

  return updates;
};

/**
 * Resolve final clip positions ensuring no gaps or overlaps
 * This is a cleanup function to ensure sequence integrity
 */
export const resolveClipPositions = (clips: Clip[]): Clip[] => {
  // Sort clips by start time
  const sorted = [...clips].sort((a, b) => a.start - b.start);

  const resolved: Clip[] = [];
  let currentPosition = 0;

  for (const clip of sorted) {
    // Ensure no overlap with previous clip
    const newStart = Math.max(clip.start, currentPosition);

    resolved.push({
      ...clip,
      start: newStart,
    });

    currentPosition = newStart + clip.duration;
  }

  return resolved;
};

/**
 * Apply clip position updates to a clips array
 */
export const applyClipUpdates = (
  clips: Clip[],
  updates: { clipId: string; newStart: number }[],
): Clip[] => {
  const updateMap = new Map(updates.map((u) => [u.clipId, u.newStart]));

  return clips.map((clip) => {
    const newStart = updateMap.get(clip.id);
    if (newStart !== undefined) {
      return { ...clip, start: newStart };
    }
    return clip;
  });
};
