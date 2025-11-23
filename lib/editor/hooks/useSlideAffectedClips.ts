import { useMemo } from 'react';
import type { Clip, Track } from '../types';

export interface AffectedClipPreview {
  clip: Clip;
  previewStart: number;
}

/**
 * Calculates which clips are affected by a slide operation and their preview positions.
 * During a slide, the dragged clip moves while maintaining gaps with adjacent clips.
 * This hook identifies adjacent clips and calculates how they will shift.
 *
 * @param activeClipId - ID of the clip being slid
 * @param previewPosition - New timeline position for the active clip (in seconds)
 * @param tracks - All timeline tracks
 * @returns Array of affected clips with their preview positions
 *
 * @example
 * const { affectedClips } = useSlideAffectedClips('clip-123', 10.5, tracks);
 * // Returns clips that will shift, with their new positions
 */
export function useSlideAffectedClips(
  activeClipId: string | null,
  previewPosition: number | null,
  tracks: Track[]
): {
  affectedClips: AffectedClipPreview[];
} {
  const affectedClips = useMemo(() => {
    if (!activeClipId || previewPosition === null) {
      return [];
    }

    // Find the active clip and its track
    let activeClip: Clip | null = null;
    let activeTrack: Track | null = null;

    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === activeClipId);
      if (clip) {
        activeClip = clip;
        activeTrack = track;
        break;
      }
    }

    if (!activeClip || !activeTrack) {
      return [];
    }

    const originalStart = activeClip.start;
    const slideOffset = previewPosition - originalStart;

    // If no movement, no affected clips
    if (Math.abs(slideOffset) < 0.001) {
      return [];
    }

    const result: AffectedClipPreview[] = [];

    // Sort clips by start time on the same track
    const trackClips = [...activeTrack.clips].sort((a, b) => a.start - b.start);

    // Find clips before and after the active clip
    const activeIndex = trackClips.findIndex((c) => c.id === activeClipId);

    if (slideOffset > 0) {
      // Sliding right: affects clips to the right
      // Calculate gap to next clip
      const nextClip = trackClips[activeIndex + 1];
      if (nextClip) {
        const gapToNext = nextClip.start - (activeClip.start + activeClip.duration);

        // If slide would invade the gap, next clip shifts
        const activeEnd = previewPosition + activeClip.duration;
        if (activeEnd > nextClip.start - gapToNext) {
          const shiftAmount = activeEnd - (nextClip.start - gapToNext);
          result.push({
            clip: nextClip,
            previewStart: nextClip.start + shiftAmount,
          });

          // Potentially affect subsequent clips as well
          for (let i = activeIndex + 2; i < trackClips.length; i++) {
            const subsequentClip = trackClips[i];
            result.push({
              clip: subsequentClip,
              previewStart: subsequentClip.start + shiftAmount,
            });
          }
        }
      }
    } else {
      // Sliding left: affects clips to the left
      // Calculate gap to previous clip
      const prevClip = trackClips[activeIndex - 1];
      if (prevClip) {
        const gapToPrev = activeClip.start - (prevClip.start + prevClip.duration);

        // If slide would invade the gap, previous clip shifts
        if (previewPosition < prevClip.start + prevClip.duration + gapToPrev) {
          const shiftAmount = previewPosition - (prevClip.start + prevClip.duration + gapToPrev);
          result.push({
            clip: prevClip,
            previewStart: prevClip.start + shiftAmount,
          });

          // Potentially affect preceding clips as well
          for (let i = activeIndex - 2; i >= 0; i--) {
            const precedingClip = trackClips[i];
            result.push({
              clip: precedingClip,
              previewStart: precedingClip.start + shiftAmount,
            });
          }
        }
      }
    }

    return result;
  }, [activeClipId, previewPosition, tracks]);

  return { affectedClips };
}
