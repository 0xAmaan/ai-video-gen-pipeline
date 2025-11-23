/**
 * @deprecated This module is deprecated as of the CapCut-style universal tracks refactor.
 *
 * The editor now uses universal tracks where any content type (video, audio, images, text)
 * can be placed on any track without restrictions. This matches modern editors like CapCut
 * and DaVinci Resolve, providing maximum flexibility for users.
 *
 * Track position now determines visual layering (z-index) rather than content type restrictions.
 * Content badges on clips show what each clip contains, but don't restrict placement.
 *
 * This file is kept for reference only and should not be imported in new code.
 * All track compatibility validation has been removed from:
 * - project-store.ts (moveClip and moveClips actions)
 * - MoveClipsCommand.ts (execute method)
 *
 * Date deprecated: 2025-11-23
 */

import type { Track } from "./types";

/**
 * Determines the type of a track based on its kind metadata
 * 
 * @param track - The track to analyze
 * @returns The track type: 'video', 'audio', or 'unknown'
 * 
 * @example
 * ```ts
 * const track = { kind: 'video', ... };
 * getTrackType(track); // 'video'
 * ```
 */
export function getTrackType(track: Track): 'video' | 'audio' | 'unknown' {
  // Video tracks and overlay tracks are considered video type
  if (track.kind === 'video' || track.kind === 'overlay') {
    return 'video';
  }
  
  // Audio tracks
  if (track.kind === 'audio') {
    return 'audio';
  }
  
  // FX and any other track types are unknown
  return 'unknown';
}

/**
 * Checks if clips can be moved between two tracks based on type compatibility
 * 
 * Video clips can only move between video/overlay tracks
 * Audio clips can only move between audio tracks
 * 
 * @param sourceTrack - The track where the clip currently resides
 * @param targetTrack - The track where the clip would be moved to
 * @returns true if the tracks are compatible, false otherwise
 * 
 * @example
 * ```ts
 * const videoTrack = { kind: 'video', ... };
 * const audioTrack = { kind: 'audio', ... };
 * isTrackCompatible(videoTrack, audioTrack); // false
 * isTrackCompatible(videoTrack, videoTrack); // true
 * ```
 */
export function isTrackCompatible(sourceTrack: Track, targetTrack: Track): boolean {
  const sourceType = getTrackType(sourceTrack);
  const targetType = getTrackType(targetTrack);
  
  // Unknown types are not compatible with anything
  if (sourceType === 'unknown' || targetType === 'unknown') {
    return false;
  }
  
  // Types must match (video->video, audio->audio)
  return sourceType === targetType;
}

/**
 * Filters all tracks to return only those compatible with the source track
 * 
 * @param sourceTrackId - The ID of the source track
 * @param allTracks - Array of all available tracks
 * @returns Array of tracks that are compatible for clip movement
 * 
 * @example
 * ```ts
 * const tracks = [
 *   { id: 'v1', kind: 'video', ... },
 *   { id: 'v2', kind: 'overlay', ... },
 *   { id: 'a1', kind: 'audio', ... }
 * ];
 * getCompatibleTracks('v1', tracks); // [{ id: 'v2', kind: 'overlay', ... }]
 * ```
 */
export function getCompatibleTracks(sourceTrackId: string, allTracks: Track[]): Track[] {
  // Find the source track
  const sourceTrack = allTracks.find(track => track.id === sourceTrackId);
  
  // If source track not found, return empty array
  if (!sourceTrack) {
    return [];
  }
  
  // Filter to compatible tracks, excluding the source track itself
  return allTracks.filter(track => {
    // Don't include the source track in results
    if (track.id === sourceTrackId) {
      return false;
    }
    
    // Check compatibility
    return isTrackCompatible(sourceTrack, track);
  });
}
