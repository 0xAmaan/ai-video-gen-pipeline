/**
 * CollisionDetector
 * =================
 *
 * Efficient spatial indexing system for detecting clip overlaps during timeline operations.
 * Uses sorted interval lists and binary search for O(log n) query performance.
 *
 * ## Features:
 *
 * - **Real-time Collision Detection**: Detects overlaps during drag operations
 * - **Spatial Indexing**: Per-track sorted clip arrays for efficient range queries
 * - **Visual Feedback**: Returns collision zones for UI highlighting
 * - **Snap-to-Valid**: Finds nearest valid drop positions (Block mode)
 * - **Performance**: Optimized for timelines with 100+ clips
 *
 * ## Usage Example:
 *
 * ```typescript
 * const detector = new CollisionDetector();
 * detector.rebuildIndex(tracks);
 *
 * // During drag: check for collisions
 * const result = detector.detectCollisions('clip-123', 'track-video-1', 5.0, 3.5);
 *
 * if (result.hasCollision) {
 *   // Show red highlight on overlapping clips
 *   result.collidingClips.forEach(clip => highlightClip(clip.id, 'red'));
 *   
 *   // In Block mode: snap to nearest valid position
 *   const validPos = detector.findNearestValidPosition('track-video-1', 3.5, 5.0);
 * }
 * ```
 *
 * @module lib/editor/collision
 */

import type { Clip, Track } from '../types';

/**
 * Represents a time interval with clip metadata
 */
export interface ClipInterval {
  clipId: string;
  start: number;
  end: number;
  clip: Clip;
}

/**
 * Result of collision detection query
 */
export interface CollisionResult {
  hasCollision: boolean;
  collidingClips: ClipInterval[];
  collisionZones: Array<{ start: number; end: number }>;
}

/**
 * Collision resolution mode
 */
export type CollisionMode = 'block' | 'insert' | 'overwrite';

/**
 * CollisionDetector Class
 * =======================
 *
 * Maintains a spatial index of clips per track and provides efficient collision queries.
 *
 * **Performance Characteristics:**
 * - Index rebuild: O(n log n) where n = total clips across all tracks
 * - Collision query: O(log n + k) where k = number of overlapping clips
 * - Memory: O(n) for storing interval lists
 *
 * **Thread Safety:** Not thread-safe. Rebuild index on every timeline mutation.
 */
export class CollisionDetector {
  /**
   * Per-track spatial index: trackId → sorted array of clip intervals
   * Clips are sorted by start time for efficient range queries
   */
  private trackIndex: Map<string, ClipInterval[]> = new Map();

  /**
   * Rebuild the spatial index from current track data
   *
   * Call this method whenever clips are added, removed, or moved between tracks.
   * The index is rebuilt from scratch to ensure consistency.
   *
   * @param tracks - All tracks in the sequence
   */
  rebuildIndex(tracks: Track[]): void {
    this.trackIndex.clear();

    for (const track of tracks) {
      const intervals: ClipInterval[] = track.clips.map((clip) => ({
        clipId: clip.id,
        start: clip.start,
        end: clip.start + clip.duration,
        clip,
      }));

      // Sort by start time for binary search
      intervals.sort((a, b) => a.start - b.start);

      this.trackIndex.set(track.id, intervals);
    }
  }

  /**
   * Detect collisions for a clip at a proposed position
   *
   * This method checks if placing a clip at the given position would overlap
   * with any existing clips on the track. It excludes the clip itself (by ID)
   * to allow checking during drag operations.
   *
   * **Algorithm:**
   * 1. Get sorted clip intervals for the target track
   * 2. Use binary search to find clips in the time range [start, end]
   * 3. Check each candidate for actual overlap
   * 4. Merge overlapping regions into collision zones
   *
   * @param draggedClipId - ID of the clip being moved (excluded from collision check)
   * @param targetTrackId - ID of the track to check collisions on
   * @param proposedStart - Proposed start time for the clip
   * @param clipDuration - Duration of the clip
   * @returns Collision detection result with overlapping clips and zones
   */
  detectCollisions(
    draggedClipId: string,
    targetTrackId: string,
    proposedStart: number,
    clipDuration: number,
  ): CollisionResult {
    const intervals = this.trackIndex.get(targetTrackId);
    if (!intervals || intervals.length === 0) {
      return { hasCollision: false, collidingClips: [], collisionZones: [] };
    }

    const proposedEnd = proposedStart + clipDuration;
    const collidingClips: ClipInterval[] = [];

    // Find all clips that overlap the proposed time range
    // Optimization: Use binary search to find the first potential overlapping clip
    const startIndex = this.findFirstOverlappingClip(intervals, proposedStart, proposedEnd);

    for (let i = startIndex; i < intervals.length; i++) {
      const interval = intervals[i];

      // Skip the dragged clip itself
      if (interval.clipId === draggedClipId) continue;

      // Check if this clip overlaps with the proposed position
      // Two intervals [a1, a2] and [b1, b2] overlap if: a1 < b2 && b1 < a2
      if (interval.start < proposedEnd && proposedStart < interval.end) {
        collidingClips.push(interval);
      }

      // Early exit: clips are sorted by start time
      // If this clip starts after the proposed end, no more collisions are possible
      if (interval.start >= proposedEnd) {
        break;
      }
    }

    // Calculate collision zones (merged overlapping regions)
    const collisionZones = this.calculateCollisionZones(
      proposedStart,
      proposedEnd,
      collidingClips,
    );

    return {
      hasCollision: collidingClips.length > 0,
      collidingClips,
      collisionZones,
    };
  }

  /**
   * Find the nearest valid (non-colliding) position for a clip
   *
   * This is used in "Block" collision mode to snap the clip to the nearest
   * position where it doesn't overlap with any other clips.
   *
   * **Strategy:**
   * 1. Check if current position is valid (no collisions)
   * 2. If invalid, try snapping to the end of the nearest preceding clip
   * 3. If that fails, try snapping to the start minus clip duration
   * 4. As a fallback, find the first gap large enough to fit the clip
   *
   * @param trackId - Track to find valid position on
   * @param proposedStart - Desired start time
   * @param clipDuration - Duration of the clip
   * @param draggedClipId - Optional ID of the clip being moved (to exclude from checks)
   * @returns Nearest valid start time, or proposedStart if already valid
   */
  findNearestValidPosition(
    trackId: string,
    proposedStart: number,
    clipDuration: number,
    draggedClipId?: string,
  ): number {
    const intervals = this.trackIndex.get(trackId);
    if (!intervals || intervals.length === 0) {
      // Empty track: any position is valid
      return Math.max(0, proposedStart);
    }

    // Check if proposed position is already valid
    const collision = this.detectCollisions(
      draggedClipId ?? '',
      trackId,
      proposedStart,
      clipDuration,
    );

    if (!collision.hasCollision) {
      return Math.max(0, proposedStart);
    }

    // Strategy: Snap to the end of the nearest preceding clip
    // Find the clip that ends closest to (but before) the proposed start
    let snapPosition = 0;
    let bestDistance = Infinity;

    for (const interval of intervals) {
      if (interval.clipId === draggedClipId) continue;

      // Try snapping to the end of this clip
      const candidateStart = interval.end;
      const candidateEnd = candidateStart + clipDuration;

      // Check if this position is valid
      const testCollision = this.detectCollisions(
        draggedClipId ?? '',
        trackId,
        candidateStart,
        clipDuration,
      );

      if (!testCollision.hasCollision) {
        const distance = Math.abs(candidateStart - proposedStart);
        if (distance < bestDistance) {
          bestDistance = distance;
          snapPosition = candidateStart;
        }
      }

      // Try snapping to the start of this clip (place before it)
      const beforeStart = interval.start - clipDuration;
      if (beforeStart >= 0) {
        const beforeCollision = this.detectCollisions(
          draggedClipId ?? '',
          trackId,
          beforeStart,
          clipDuration,
        );

        if (!beforeCollision.hasCollision) {
          const distance = Math.abs(beforeStart - proposedStart);
          if (distance < bestDistance) {
            bestDistance = distance;
            snapPosition = beforeStart;
          }
        }
      }
    }

    return Math.max(0, snapPosition);
  }

  /**
   * Get all gaps on a track where a clip of given duration could fit
   *
   * This is useful for "Insert" mode to find valid insertion points.
   *
   * @param trackId - Track to analyze
   * @param clipDuration - Duration of clip to insert
   * @returns Array of valid gap positions [start, end]
   */
  findGaps(trackId: string, clipDuration: number): Array<{ start: number; end: number }> {
    const intervals = this.trackIndex.get(trackId);
    if (!intervals || intervals.length === 0) {
      // Empty track: entire timeline is available
      return [{ start: 0, end: Infinity }];
    }

    const gaps: Array<{ start: number; end: number }> = [];

    // Check gap before first clip
    if (intervals[0].start >= clipDuration) {
      gaps.push({ start: 0, end: intervals[0].start });
    }

    // Check gaps between clips
    for (let i = 0; i < intervals.length - 1; i++) {
      const currentEnd = intervals[i].end;
      const nextStart = intervals[i + 1].start;
      const gapSize = nextStart - currentEnd;

      if (gapSize >= clipDuration) {
        gaps.push({ start: currentEnd, end: nextStart });
      }
    }

    // Gap after last clip extends to infinity
    const lastEnd = intervals[intervals.length - 1].end;
    gaps.push({ start: lastEnd, end: Infinity });

    return gaps;
  }

  /**
   * Binary search helper: Find the first clip that could overlap with the range
   *
   * Returns the index of the first clip where clip.end > rangeStart
   * This is the earliest clip that could potentially overlap with [rangeStart, rangeEnd]
   *
   * @private
   */
  private findFirstOverlappingClip(
    intervals: ClipInterval[],
    rangeStart: number,
    rangeEnd: number,
  ): number {
    let left = 0;
    let right = intervals.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (intervals[mid].end <= rangeStart) {
        // This clip ends before the range starts, search right half
        left = mid + 1;
      } else {
        // This clip might overlap, search left half
        right = mid;
      }
    }

    return left;
  }

  /**
   * Calculate merged collision zones from overlapping clips
   *
   * Takes a list of overlapping clips and merges them into contiguous collision zones.
   * Example: Clips at [5-8, 7-10, 12-15] with proposed range [6-14] produces zones:
   *   [6-8, 7-10, 12-14] → merged → [6-10, 12-14]
   *
   * @private
   */
  private calculateCollisionZones(
    proposedStart: number,
    proposedEnd: number,
    collidingClips: ClipInterval[],
  ): Array<{ start: number; end: number }> {
    if (collidingClips.length === 0) return [];

    // Create intervals for the overlapping regions
    const overlapIntervals = collidingClips.map((clip) => ({
      start: Math.max(proposedStart, clip.start),
      end: Math.min(proposedEnd, clip.end),
    }));

    // Sort by start time
    overlapIntervals.sort((a, b) => a.start - b.start);

    // Merge overlapping intervals
    const merged: Array<{ start: number; end: number }> = [];
    let current = overlapIntervals[0];

    for (let i = 1; i < overlapIntervals.length; i++) {
      const next = overlapIntervals[i];

      if (current.end >= next.start) {
        // Overlapping or adjacent: merge
        current = { start: current.start, end: Math.max(current.end, next.end) };
      } else {
        // Non-overlapping: push current and start new interval
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Get all clips in a time range on a track
   *
   * Useful for ripple operations or selecting clips in a region.
   *
   * @param trackId - Track to query
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns All clips that overlap with the time range
   */
  getClipsInRange(trackId: string, startTime: number, endTime: number): Clip[] {
    const intervals = this.trackIndex.get(trackId);
    if (!intervals) return [];

    const startIndex = this.findFirstOverlappingClip(intervals, startTime, endTime);
    const result: Clip[] = [];

    for (let i = startIndex; i < intervals.length; i++) {
      const interval = intervals[i];

      if (interval.start < endTime && startTime < interval.end) {
        result.push(interval.clip);
      }

      if (interval.start >= endTime) {
        break;
      }
    }

    return result;
  }

  /**
   * Check if a track allows overlapping clips
   *
   * Some tracks (like audio) may allow overlap, while others (like video) may not.
   * This method should check the track's allowOverlap property.
   *
   * @param trackId - Track to check
   * @param tracks - All tracks in the sequence
   * @returns True if the track allows overlapping clips
   */
  static doesTrackAllowOverlap(trackId: string, tracks: Track[]): boolean {
    const track = tracks.find((t) => t.id === trackId);
    return track?.allowOverlap ?? false;
  }
}
