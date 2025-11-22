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

  // Create SnapManager instance (singleton)
  const manager = useMemo(() => new SnapManager(), []);

  // Extract beat markers from audio assets
  const beatMarkers = useMemo(() => {
    if (!project) return [];

    const allBeats: BeatMarker[] = [];
    
    // Collect beat markers from all audio assets
    Object.values(project.mediaAssets).forEach((asset) => {
      if (asset.type === "audio" && asset.beatMarkers) {
        // Adjust beat times if asset has a timeline offset
        const timeOffset = (asset as any).timelineStart ?? 0;
        const adjustedBeats = asset.beatMarkers.map((beat) => ({
          time: beat.time + timeOffset,
          strength: beat.strength,
        }));
        allBeats.push(...adjustedBeats);
      }
    });

    // Sort by time
    return allBeats.sort((a, b) => a.time - b.time);
  }, [project]);

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
