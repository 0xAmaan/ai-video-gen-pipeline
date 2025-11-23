/**
 * React hook for integrating SnapManager with the editor
 * 
 * Provides beat-based snapping functionality with access to project audio data.
 * 
 * Usage:
 * ```tsx
 * const { snapToBeats, snapClipToBeats, beatMarkers, bpm } = useSnapManager();
 * 
 * const snappedTime = snapToBeats(dragTime, { enabled: snapEnabled });
 * ```
 */

import { useMemo } from "react";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { SnapManager, type SnapOptions, type SnapResult } from "@/lib/editor/utils/SnapManager";
import type { BeatMarker } from "@/types/audio";

export interface UseSnapManagerResult {
  /** Snap a single timestamp to beats */
  snapToBeats: (timestamp: number, options?: SnapOptions) => SnapResult;
  
  /** Snap clip start and duration to beats */
  snapClipToBeats: (
    start: number,
    duration: number,
    options?: SnapOptions,
  ) => { start: number; duration: number };
  
  /** All beat markers from audio assets in the project */
  beatMarkers: BeatMarker[];
  
  /** Calculated or extracted BPM from audio */
  bpm: number | null;
  
  /** Whether snap is enabled in project settings */
  snapEnabled: boolean;
  
  /** Direct access to SnapManager instance */
  manager: SnapManager;
}

/**
 * Hook to access SnapManager with project audio data
 */
export const useSnapManager = (): UseSnapManagerResult => {
  const project = useProjectStore((state) => state.project);
  const snapEnabled = useProjectStore((state) => state.project?.settings.snap ?? true);
  const snapToBeatsEnabled = useProjectStore((state) => state.project?.settings.snapToBeats ?? true);

  // Create SnapManager instance (singleton)
  const manager = useMemo(() => new SnapManager(), []);

  // Extract beat markers from clips on the timeline
  const beatMarkers = useMemo(() => {
    // If beat snapping is disabled, return empty array to skip processing
    if (!project || !snapToBeatsEnabled) return [];

    const allBeats: BeatMarker[] = [];
    
    // Get the active sequence
    const activeSequence = project.sequences.find(
      (seq) => seq.id === project.settings.activeSequenceId
    );
    
    if (!activeSequence) return [];
    
    // Iterate through all clips in all tracks
    activeSequence.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        // Get the associated media asset
        const asset = project.mediaAssets[clip.mediaId];
        
        // Only process audio assets with beat markers
        if (!asset || asset.type !== "audio" || !asset.beatMarkers) {
          return;
        }
        
        // Calculate the active range of the clip in source media time
        const sourceStart = clip.trimStart;
        const sourceEnd = clip.trimStart + clip.duration;
        
        // Filter and transform beat markers for this clip
        const clipBeats = asset.beatMarkers
          .filter((beat) => beat.time >= sourceStart && beat.time <= sourceEnd)
          .map((beat) => ({
            time: (beat.time - clip.trimStart) + clip.start,
            strength: beat.strength ?? 1.0,
          }));
        
        allBeats.push(...clipBeats);
      });
    });

    // Sort by time and remove duplicates (in case of overlapping clips)
    const sorted = allBeats.sort((a, b) => a.time - b.time);
    
    // Remove near-duplicate beats (within 0.01 seconds)
    const deduplicated: BeatMarker[] = [];
    for (const beat of sorted) {
      if (deduplicated.length === 0 ||
          Math.abs(beat.time - deduplicated[deduplicated.length - 1].time) > 0.01) {
        deduplicated.push(beat);
      }
    }
    
    return deduplicated;
  }, [project, snapToBeatsEnabled]);

  // Calculate BPM from beat markers
  const bpm = useMemo(() => {
    if (beatMarkers.length < 2) return null;
    return manager.calculateBPMFromBeats(beatMarkers);
  }, [beatMarkers, manager]);

  // Snap functions with default options from project settings
  const snapToBeats = (timestamp: number, options: SnapOptions = {}): SnapResult => {
    return manager.snapToBeats(timestamp, beatMarkers, {
      enabled: snapEnabled,
      tolerance: project?.settings.snapThreshold ?? 0.12,
      bpm: bpm ?? undefined,
      ...options,
    });
  };

  const snapClipToBeats = (
    start: number,
    duration: number,
    options: SnapOptions = {},
  ): { start: number; duration: number } => {
    return manager.snapClipToBeats(start, duration, beatMarkers, {
      enabled: snapEnabled,
      tolerance: project?.settings.snapThreshold ?? 0.12,
      bpm: bpm ?? undefined,
      ...options,
    });
  };

  return {
    snapToBeats,
    snapClipToBeats,
    beatMarkers,
    bpm,
    snapEnabled,
    manager,
  };
};
