/**
 * Auto-Splice Utilities
 * 
 * Provides functionality to automatically split clips at beat markers
 */

import type { Project, Clip, MediaAssetMeta } from "../types";
import { ClipSplitCommand } from "../history/commands/ClipSplitCommand";
import { suggestSceneCutPoints } from "../audio-beat-helpers";

export interface AutoSpliceOptions {
  /** Number of beats per cut (e.g., 4 = every 4 beats) */
  beatsPerCut?: number;
  /** Minimum beat strength (0-1, higher = only strong beats) */
  minStrength?: number;
  /** Time offset for alignment (-0.1 to +0.1 seconds) */
  alignmentOffset?: number;
  /** Only use downbeats (strong beats) */
  downbeatsOnly?: boolean;
}

export interface AutoSpliceResult {
  success: boolean;
  project?: Project;
  cutCount: number;
  cutTimes: number[];
  error?: string;
}

/**
 * Find a clip in the project by ID
 */
function findClipInProject(project: Project, clipId: string): Clip | null {
  for (const sequence of project.sequences) {
    for (const track of sequence.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
  }
  return null;
}

/**
 * Get beat markers for a clip from its media asset
 */
function getBeatMarkersForClip(
  project: Project,
  clip: Clip
): Array<{ time: number; strength?: number; isDownbeat?: boolean }> | undefined {
  const asset = project.mediaAssets[clip.mediaId];
  if (!asset) return undefined;
  return asset.beatMarkers;
}

/**
 * Calculate cut points for a clip based on beat markers and options
 */
export function calculateCutPoints(
  clip: Clip,
  beatMarkers: Array<{ time: number; strength?: number; isDownbeat?: boolean }>,
  options: AutoSpliceOptions = {}
): number[] {
  const {
    beatsPerCut = 4,
    minStrength = 0,
    alignmentOffset = 0,
    downbeatsOnly = false,
  } = options;

  // Filter beats based on options
  let filteredBeats = beatMarkers.filter((beat) => {
    // Apply minimum strength filter
    if (minStrength > 0 && (beat.strength ?? 0) < minStrength) {
      return false;
    }
    // Apply downbeats-only filter
    if (downbeatsOnly && !beat.isDownbeat) {
      return false;
    }
    return true;
  });

  // Use helper to suggest cut points based on beats per cut
  const cutTimes = suggestSceneCutPoints(filteredBeats, {
    beatsPerCut,
    minStrength,
  });

  // Filter to only beats within the clip's time range (accounting for trim)
  const clipStart = clip.trimStart;
  const clipEnd = clip.trimStart + clip.duration;

  const validCutTimes = cutTimes
    .filter((time) => time > clipStart && time < clipEnd)
    .map((time) => time + alignmentOffset);

  // Convert from media time to clip-relative offsets
  const clipRelativeOffsets = validCutTimes.map((time) => time - clipStart);

  return clipRelativeOffsets;
}

/**
 * Preview auto-splice operation without executing it
 */
export function previewAutoSplice(
  project: Project,
  clipId: string,
  options: AutoSpliceOptions = {}
): {
  success: boolean;
  cutCount: number;
  cutTimes: number[];
  error?: string;
} {
  const clip = findClipInProject(project, clipId);
  if (!clip) {
    return {
      success: false,
      cutCount: 0,
      cutTimes: [],
      error: `Clip ${clipId} not found`,
    };
  }

  const beatMarkers = getBeatMarkersForClip(project, clip);
  if (!beatMarkers || beatMarkers.length === 0) {
    return {
      success: false,
      cutCount: 0,
      cutTimes: [],
      error: "No beat markers found for this clip",
    };
  }

  const cutOffsets = calculateCutPoints(clip, beatMarkers, options);

  return {
    success: true,
    cutCount: cutOffsets.length,
    cutTimes: cutOffsets.map((offset) => clip.start + offset),
  };
}

/**
 * Automatically splice a clip at beat markers
 * 
 * @param project - The current project
 * @param clipId - ID of the clip to splice
 * @param options - Splice options (beats per cut, min strength, etc.)
 * @returns Result with updated project or error
 */
export function autoSpliceOnBeats(
  project: Project,
  clipId: string,
  options: AutoSpliceOptions = {}
): AutoSpliceResult {
  // Find the clip
  const clip = findClipInProject(project, clipId);
  if (!clip) {
    return {
      success: false,
      cutCount: 0,
      cutTimes: [],
      error: `Clip ${clipId} not found`,
    };
  }

  // Get beat markers from the media asset
  const beatMarkers = getBeatMarkersForClip(project, clip);
  if (!beatMarkers || beatMarkers.length === 0) {
    return {
      success: false,
      cutCount: 0,
      cutTimes: [],
      error: "No beat markers found for this clip",
    };
  }

  // Calculate cut points
  const cutOffsets = calculateCutPoints(clip, beatMarkers, options);

  if (cutOffsets.length === 0) {
    return {
      success: false,
      cutCount: 0,
      cutTimes: [],
      error: "No valid cut points found with current options",
    };
  }

  // Sort offsets in reverse order (split from right to left to maintain indices)
  const sortedOffsets = [...cutOffsets].sort((a, b) => b - a);

  // Execute splits
  let currentProject = project;
  const cutTimes: number[] = [];

  for (const offset of sortedOffsets) {
    // Create temporary getter/setter for command
    let tempProject = currentProject;
    const getProject = () => tempProject;
    const setProject = (p: Project) => {
      tempProject = p;
    };

    try {
      const command = new ClipSplitCommand(getProject, setProject, clipId, offset);
      const success = command.execute();

      if (!success) {
        console.warn(`[autoSpliceOnBeats] Failed to split at offset ${offset}`);
        continue;
      }

      currentProject = tempProject;
      cutTimes.push(clip.start + offset);
    } catch (error) {
      console.error(`[autoSpliceOnBeats] Error splitting at offset ${offset}:`, error);
      continue;
    }
  }

  return {
    success: true,
    project: currentProject,
    cutCount: cutTimes.length,
    cutTimes: cutTimes.reverse(), // Return in chronological order
  };
}

/**
 * Get beat analysis status for a clip
 */
export function getClipBeatAnalysisStatus(
  project: Project,
  clipId: string
): {
  hasBeats: boolean;
  beatCount: number;
  bpm?: number;
} | null {
  const clip = findClipInProject(project, clipId);
  if (!clip) return null;

  const beatMarkers = getBeatMarkersForClip(project, clip);
  const asset = project.mediaAssets[clip.mediaId];

  return {
    hasBeats: (beatMarkers?.length ?? 0) > 0,
    beatCount: beatMarkers?.length ?? 0,
    bpm: asset?.bpm,
  };
}
