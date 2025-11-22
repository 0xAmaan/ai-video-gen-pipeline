/**
 * SnapManager - Utility for quantizing clip positions to beat intervals
 * 
 * Provides beat-based snapping functionality for timeline editing operations.
 * Integrates with audio analysis data (BPM/beat markers) from the project store.
 * 
 * Usage:
 * ```tsx
 * const snapManager = new SnapManager();
 * const snappedTime = snapManager.snapToBeats(dragTime, beatMarkers, { tolerance: 0.1 });
 * ```
 */

import type { BeatMarker } from "@/types/audio";
import { snapTimeToBeatMarkers } from "@/lib/editor/audio-beat-helpers";

export interface SnapOptions {
  /** Enable/disable snapping (default: true) */
  enabled?: boolean;
  /** Snap tolerance in seconds (default: 0.12) */
  tolerance?: number;
  /** Snap to beat markers vs grid (default: true uses markers) */
  useBeatMarkers?: boolean;
  /** BPM for grid-based snapping when beat markers aren't available */
  bpm?: number;
}

export interface SnapResult {
  /** Original time value */
  originalTime: number;
  /** Snapped time value */
  snappedTime: number;
  /** Whether snapping was applied */
  wasSnapped: boolean;
  /** Distance from original to snapped position */
  snapDistance: number;
}

export class SnapManager {
  private defaultTolerance = 0.12; // seconds

  /**
   * Calculate beat interval in seconds from BPM
   */
  calculateBeatInterval(bpm: number): number {
    if (!bpm || bpm <= 0) return 0;
    return 60 / bpm; // seconds per beat
  }

  /**
   * Generate beat markers from BPM when explicit markers aren't available
   */
  generateBeatMarkersFromBPM(bpm: number, duration: number): BeatMarker[] {
    const beatInterval = this.calculateBeatInterval(bpm);
    if (beatInterval <= 0 || duration <= 0) return [];

    const markers: BeatMarker[] = [];
    let time = 0;

    while (time <= duration) {
      markers.push({ time, strength: 1.0 });
      time += beatInterval;
    }

    return markers;
  }

  /**
   * Quantize timestamp to nearest beat
   * Uses beat markers if available, otherwise falls back to BPM-based grid
   */
  quantizeToNearestBeat(
    timestamp: number,
    beatMarkers: BeatMarker[],
    bpm?: number,
    tolerance: number = this.defaultTolerance,
  ): number {
    // Use beat markers if available
    if (beatMarkers && beatMarkers.length > 0) {
      return snapTimeToBeatMarkers(timestamp, beatMarkers, tolerance);
    }

    // Fallback to BPM-based grid
    if (bpm && bpm > 0) {
      const beatInterval = this.calculateBeatInterval(bpm);
      const beatIndex = Math.round(timestamp / beatInterval);
      const snappedTime = beatIndex * beatInterval;

      // Only snap if within tolerance
      if (Math.abs(snappedTime - timestamp) <= tolerance) {
        return snappedTime;
      }
    }

    // No snapping possible, return original
    return timestamp;
  }

  /**
   * Snap to beats with detailed result information
   */
  snapToBeats(
    timestamp: number,
    beatMarkers: BeatMarker[] = [],
    options: SnapOptions = {},
  ): SnapResult {
    const {
      enabled = true,
      tolerance = this.defaultTolerance,
      useBeatMarkers = true,
      bpm,
    } = options;

    if (!enabled) {
      return {
        originalTime: timestamp,
        snappedTime: timestamp,
        wasSnapped: false,
        snapDistance: 0,
      };
    }

    const markers = useBeatMarkers ? beatMarkers : [];
    const snappedTime = this.quantizeToNearestBeat(
      timestamp,
      markers,
      bpm,
      tolerance,
    );

    return {
      originalTime: timestamp,
      snappedTime,
      wasSnapped: snappedTime !== timestamp,
      snapDistance: Math.abs(snappedTime - timestamp),
    };
  }

  /**
   * Snap clip start and duration to beats
   * Ensures both start and end positions align with beat grid
   */
  snapClipToBeats(
    start: number,
    duration: number,
    beatMarkers: BeatMarker[] = [],
    options: SnapOptions = {},
  ): { start: number; duration: number } {
    const startSnap = this.snapToBeats(start, beatMarkers, options);
    const endSnap = this.snapToBeats(start + duration, beatMarkers, options);

    return {
      start: startSnap.snappedTime,
      duration: Math.max(0.1, endSnap.snappedTime - startSnap.snappedTime),
    };
  }

  /**
   * Find nearest beat marker to a given time
   */
  findNearestBeat(
    timestamp: number,
    beatMarkers: BeatMarker[],
  ): BeatMarker | null {
    if (!beatMarkers || beatMarkers.length === 0) return null;

    let nearest: BeatMarker | null = null;
    let minDistance = Infinity;

    for (const beat of beatMarkers) {
      const distance = Math.abs(beat.time - timestamp);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = beat;
      }
    }

    return nearest;
  }

  /**
   * Get all beat markers within a time range
   */
  getBeatsInRange(
    startTime: number,
    endTime: number,
    beatMarkers: BeatMarker[],
  ): BeatMarker[] {
    return beatMarkers.filter(
      (beat) => beat.time >= startTime && beat.time <= endTime,
    );
  }

  /**
   * Calculate BPM from beat markers (if not explicitly provided)
   */
  calculateBPMFromBeats(beatMarkers: BeatMarker[]): number | null {
    if (!beatMarkers || beatMarkers.length < 2) return null;

    // Calculate average interval between consecutive beats
    const intervals: number[] = [];
    for (let i = 1; i < beatMarkers.length; i++) {
      intervals.push(beatMarkers[i].time - beatMarkers[i - 1].time);
    }

    if (intervals.length === 0) return null;

    const avgInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const bpm = 60 / avgInterval;

    return Math.round(bpm);
  }
}

// Singleton instance for convenience
export const snapManager = new SnapManager();
