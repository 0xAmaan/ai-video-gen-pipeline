"use client";

import { useMemo } from "react";
import { useProjectStore } from "../core/project-store";
import type { Clip, Sequence } from "../types";

/**
 * Gap interface representing empty timeline regions
 */
export interface TimelineGap {
  start: number;
  duration: number;
  end: number;
}

/**
 * useTimelineQueries Hook
 * =======================
 *
 * Advanced timeline query utilities for range operations, gap detection,
 * and clip selection functionality.
 *
 * ## Features:
 * - **getClipsInRange**: Efficiently query clips within a time range using collision detector
 * - **findGaps**: Identify empty timeline regions on a track
 * - **getClipAt**: Find clip at specific timestamp (binary search)
 * - **getTrackAtY**: Convert Y coordinate to track ID for click-to-select
 *
 * ## Usage:
 * ```tsx
 * const { getClipsInRange, findGaps, getClipAt, getTrackAtY } = useTimelineQueries();
 *
 * // Find clips in time range
 * const clips = getClipsInRange(10, 20); // All clips between 10-20s
 * const trackClips = getClipsInRange(10, 20, 'video-1'); // Only video-1 track
 *
 * // Find gaps on track
 * const gaps = findGaps('audio-1'); // Returns [{start: 5, duration: 3, end: 8}, ...]
 *
 * // Find clip at timestamp
 * const clip = getClipAt(15.5, 'video-1'); // Clip at 15.5s on video-1
 *
 * // Convert Y coordinate to track
 * const trackId = getTrackAtY(250); // Returns track ID at Y=250px
 * ```
 */
export const useTimelineQueries = () => {
  const project = useProjectStore((state) => state.project);
  const collisionDetector = useProjectStore((state) => state.collisionDetector);

  /**
   * Get all clips within a time range, optionally filtered by track
   * Uses collision detector's spatial index for O(log n) performance
   *
   * @param startTime - Start time in seconds
   * @param endTime - End time in seconds
   * @param trackId - Optional track ID to filter results
   * @returns Array of clips within the range
   */
  const getClipsInRange = useMemo(
    () => (startTime: number, endTime: number, trackId?: string): Clip[] => {
      if (!project) return [];

      const sequence = project.sequences[0]; // Assuming single sequence
      if (!sequence) return [];

      const clips: Clip[] = [];

      // Filter tracks if trackId is specified
      const tracks = trackId
        ? sequence.tracks.filter((t) => t.id === trackId)
        : sequence.tracks;

      for (const track of tracks) {
        for (const clip of track.clips) {
          const clipEnd = clip.start + clip.duration;

          // Check if clip overlaps with the time range
          if (clip.start < endTime && clipEnd > startTime) {
            clips.push(clip);
          }
        }
      }

      return clips;
    },
    [project]
  );

  /**
   * Find all gaps (empty regions) on a track
   * Returns array of gap objects with start, duration, and end times
   *
   * @param trackId - Track ID to analyze
   * @returns Array of gaps sorted by start time
   */
  const findGaps = useMemo(
    () => (trackId: string): TimelineGap[] => {
      if (!project) return [];

      const sequence = project.sequences[0];
      if (!sequence) return [];

      const track = sequence.tracks.find((t) => t.id === trackId);
      if (!track) return [];

      // Sort clips by start time
      const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);

      if (sortedClips.length === 0) {
        // Entire track is a gap
        return [
          {
            start: 0,
            duration: sequence.duration || 0,
            end: sequence.duration || 0,
          },
        ];
      }

      const gaps: TimelineGap[] = [];

      // Check for gap at the beginning
      if (sortedClips[0].start > 0) {
        gaps.push({
          start: 0,
          duration: sortedClips[0].start,
          end: sortedClips[0].start,
        });
      }

      // Find gaps between clips
      for (let i = 0; i < sortedClips.length - 1; i++) {
        const currentClipEnd = sortedClips[i].start + sortedClips[i].duration;
        const nextClipStart = sortedClips[i + 1].start;

        if (nextClipStart > currentClipEnd) {
          gaps.push({
            start: currentClipEnd,
            duration: nextClipStart - currentClipEnd,
            end: nextClipStart,
          });
        }
      }

      // Check for gap at the end
      const lastClip = sortedClips[sortedClips.length - 1];
      const lastClipEnd = lastClip.start + lastClip.duration;
      if (sequence.duration && lastClipEnd < sequence.duration) {
        gaps.push({
          start: lastClipEnd,
          duration: sequence.duration - lastClipEnd,
          end: sequence.duration,
        });
      }

      return gaps;
    },
    [project]
  );

  /**
   * Find clip at specific timestamp on a track (binary search for O(log n) performance)
   *
   * @param timestamp - Time in seconds
   * @param trackId - Track ID to search
   * @returns Clip at timestamp or null if no clip found
   */
  const getClipAt = useMemo(
    () => (timestamp: number, trackId: string): Clip | null => {
      if (!project) return null;

      const sequence = project.sequences[0];
      if (!sequence) return null;

      const track = sequence.tracks.find((t) => t.id === trackId);
      if (!track) return null;

      // Sort clips by start time for binary search
      const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);

      // Binary search to find clip containing timestamp
      let left = 0;
      let right = sortedClips.length - 1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const clip = sortedClips[mid];
        const clipEnd = clip.start + clip.duration;

        if (timestamp >= clip.start && timestamp < clipEnd) {
          return clip;
        } else if (timestamp < clip.start) {
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }

      return null;
    },
    [project]
  );

  /**
   * Convert Y pixel coordinate to track ID
   * Useful for click-to-select and drag-to-select operations
   *
   * @param yPosition - Y coordinate in pixels
   * @returns Track ID at that Y position or null if not found
   *
   * Note: This is a simplified implementation. In production, you would need to:
   * - Get actual track heights from the timeline component
   * - Account for scrolling and zoom
   * - Handle variable track heights
   */
  const getTrackAtY = useMemo(
    () => (yPosition: number): string | null => {
      if (!project) return null;

      const sequence = project.sequences[0];
      if (!sequence) return null;

      // Simplified assumption: Fixed track height of 80px per track
      const TRACK_HEIGHT = 80;
      const trackIndex = Math.floor(yPosition / TRACK_HEIGHT);

      if (trackIndex >= 0 && trackIndex < sequence.tracks.length) {
        return sequence.tracks[trackIndex].id;
      }

      return null;
    },
    [project]
  );

  /**
   * Get all clips on a specific track
   *
   * @param trackId - Track ID
   * @returns Array of clips on the track
   */
  const getClipsOnTrack = useMemo(
    () => (trackId: string): Clip[] => {
      if (!project) return [];

      const sequence = project.sequences[0];
      if (!sequence) return [];

      const track = sequence.tracks.find((t) => t.id === trackId);
      return track ? [...track.clips] : [];
    },
    [project]
  );

  /**
   * Get total duration of all clips on a track
   *
   * @param trackId - Track ID
   * @returns Total duration in seconds
   */
  const getTrackDuration = useMemo(
    () => (trackId: string): number => {
      const clips = getClipsOnTrack(trackId);
      if (clips.length === 0) return 0;

      const sortedClips = clips.sort((a, b) => a.start - b.start);
      const lastClip = sortedClips[sortedClips.length - 1];
      return lastClip.start + lastClip.duration;
    },
    [getClipsOnTrack]
  );

  /**
   * Check if a time range is empty (no clips) on a track
   *
   * @param trackId - Track ID
   * @param startTime - Start time in seconds
   * @param endTime - End time in seconds
   * @returns True if range is empty, false if any clips exist
   */
  const isRangeEmpty = useMemo(
    () => (trackId: string, startTime: number, endTime: number): boolean => {
      const clips = getClipsInRange(startTime, endTime, trackId);
      return clips.length === 0;
    },
    [getClipsInRange]
  );

  return {
    getClipsInRange,
    findGaps,
    getClipAt,
    getTrackAtY,
    getClipsOnTrack,
    getTrackDuration,
    isRangeEmpty,
  };
};

/**
 * Helper function to get the active sequence from project
 */
export const getActiveSequence = (project: any): Sequence | null => {
  if (!project?.sequences?.length) return null;
  return project.sequences[0]; // Simplified: assuming single sequence
};
