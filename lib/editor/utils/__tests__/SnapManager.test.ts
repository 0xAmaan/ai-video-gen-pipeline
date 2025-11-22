/**
 * Tests for SnapManager beat quantization logic
 */

import { SnapManager } from "../SnapManager";
import type { BeatMarker } from "@/types/audio";

describe("SnapManager", () => {
  let snapManager: SnapManager;

  beforeEach(() => {
    snapManager = new SnapManager();
  });

  describe("calculateBeatInterval", () => {
    it("should calculate correct beat interval for 120 BPM", () => {
      const interval = snapManager.calculateBeatInterval(120);
      expect(interval).toBeCloseTo(0.5, 3); // 60/120 = 0.5 seconds
    });

    it("should calculate correct beat interval for 90 BPM", () => {
      const interval = snapManager.calculateBeatInterval(90);
      expect(interval).toBeCloseTo(0.667, 3); // 60/90 ≈ 0.667 seconds
    });

    it("should calculate correct beat interval for 140 BPM", () => {
      const interval = snapManager.calculateBeatInterval(140);
      expect(interval).toBeCloseTo(0.429, 3); // 60/140 ≈ 0.429 seconds
    });

    it("should return 0 for invalid BPM", () => {
      expect(snapManager.calculateBeatInterval(0)).toBe(0);
      expect(snapManager.calculateBeatInterval(-10)).toBe(0);
    });
  });

  describe("generateBeatMarkersFromBPM", () => {
    it("should generate correct beat markers for 120 BPM over 2 seconds", () => {
      const markers = snapManager.generateBeatMarkersFromBPM(120, 2);
      expect(markers.length).toBe(5); // 0, 0.5, 1.0, 1.5, 2.0
      expect(markers[0].time).toBe(0);
      expect(markers[1].time).toBeCloseTo(0.5, 3);
      expect(markers[2].time).toBeCloseTo(1.0, 3);
      expect(markers[3].time).toBeCloseTo(1.5, 3);
      expect(markers[4].time).toBeCloseTo(2.0, 3);
    });

    it("should return empty array for invalid inputs", () => {
      expect(snapManager.generateBeatMarkersFromBPM(0, 10)).toEqual([]);
      expect(snapManager.generateBeatMarkersFromBPM(120, 0)).toEqual([]);
      expect(snapManager.generateBeatMarkersFromBPM(-1, 10)).toEqual([]);
    });
  });

  describe("quantizeToNearestBeat", () => {
    const beatMarkers: BeatMarker[] = [
      { time: 0, strength: 1 },
      { time: 0.5, strength: 1 },
      { time: 1.0, strength: 1 },
      { time: 1.5, strength: 1 },
      { time: 2.0, strength: 1 },
    ];

    it("should snap to nearest beat when within tolerance", () => {
      expect(snapManager.quantizeToNearestBeat(0.52, beatMarkers)).toBeCloseTo(0.5, 3);
      expect(snapManager.quantizeToNearestBeat(0.98, beatMarkers)).toBeCloseTo(1.0, 3);
      expect(snapManager.quantizeToNearestBeat(1.48, beatMarkers)).toBeCloseTo(1.5, 3);
    });

    it("should not snap when outside tolerance", () => {
      const time = 0.7;
      const result = snapManager.quantizeToNearestBeat(time, beatMarkers, undefined, 0.1);
      expect(result).toBe(time);
    });

    it("should use BPM fallback when no beat markers provided", () => {
      const result = snapManager.quantizeToNearestBeat(0.52, [], 120);
      expect(result).toBeCloseTo(0.5, 3);
    });

    it("should return original time when no snap data available", () => {
      const time = 0.75;
      expect(snapManager.quantizeToNearestBeat(time, [])).toBe(time);
    });
  });

  describe("snapToBeats", () => {
    const beatMarkers: BeatMarker[] = [
      { time: 0, strength: 1 },
      { time: 0.5, strength: 1 },
      { time: 1.0, strength: 1 },
    ];

    it("should return snap result with correct information", () => {
      const result = snapManager.snapToBeats(0.52, beatMarkers);
      expect(result.originalTime).toBe(0.52);
      expect(result.snappedTime).toBeCloseTo(0.5, 3);
      expect(result.wasSnapped).toBe(true);
      expect(result.snapDistance).toBeCloseTo(0.02, 3);
    });

    it("should not snap when disabled", () => {
      const result = snapManager.snapToBeats(0.52, beatMarkers, { enabled: false });
      expect(result.originalTime).toBe(0.52);
      expect(result.snappedTime).toBe(0.52);
      expect(result.wasSnapped).toBe(false);
      expect(result.snapDistance).toBe(0);
    });
  });

  describe("snapClipToBeats", () => {
    const beatMarkers: BeatMarker[] = [
      { time: 0, strength: 1 },
      { time: 0.5, strength: 1 },
      { time: 1.0, strength: 1 },
      { time: 1.5, strength: 1 },
      { time: 2.0, strength: 1 },
    ];

    it("should snap both start and duration to beats", () => {
      const result = snapManager.snapClipToBeats(0.52, 0.96, beatMarkers);
      expect(result.start).toBeCloseTo(0.5, 3);
      expect(result.duration).toBeCloseTo(1.0, 3); // End: 0.52 + 0.96 = 1.48 → snaps to 1.5
    });

    it("should ensure minimum duration", () => {
      const result = snapManager.snapClipToBeats(0.5, 0.01, beatMarkers);
      expect(result.duration).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("findNearestBeat", () => {
    const beatMarkers: BeatMarker[] = [
      { time: 0, strength: 1 },
      { time: 0.5, strength: 0.8 },
      { time: 1.0, strength: 1 },
    ];

    it("should find the nearest beat marker", () => {
      const nearest = snapManager.findNearestBeat(0.52, beatMarkers);
      expect(nearest).toBeDefined();
      expect(nearest?.time).toBe(0.5);
    });

    it("should return null for empty markers", () => {
      expect(snapManager.findNearestBeat(0.5, [])).toBeNull();
    });
  });

  describe("getBeatsInRange", () => {
    const beatMarkers: BeatMarker[] = [
      { time: 0, strength: 1 },
      { time: 0.5, strength: 1 },
      { time: 1.0, strength: 1 },
      { time: 1.5, strength: 1 },
      { time: 2.0, strength: 1 },
    ];

    it("should return beats within range", () => {
      const beats = snapManager.getBeatsInRange(0.5, 1.5, beatMarkers);
      expect(beats.length).toBe(3); // 0.5, 1.0, 1.5
      expect(beats[0].time).toBe(0.5);
      expect(beats[1].time).toBe(1.0);
      expect(beats[2].time).toBe(1.5);
    });

    it("should return empty array when no beats in range", () => {
      const beats = snapManager.getBeatsInRange(2.5, 3.0, beatMarkers);
      expect(beats.length).toBe(0);
    });
  });

  describe("calculateBPMFromBeats", () => {
    it("should calculate BPM from uniform beat markers", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1 },
        { time: 0.5, strength: 1 },
        { time: 1.0, strength: 1 },
        { time: 1.5, strength: 1 },
      ];
      const bpm = snapManager.calculateBPMFromBeats(beatMarkers);
      expect(bpm).toBe(120); // 60 / 0.5 = 120 BPM
    });

    it("should return null for insufficient data", () => {
      expect(snapManager.calculateBPMFromBeats([])).toBeNull();
      expect(snapManager.calculateBPMFromBeats([{ time: 0, strength: 1 }])).toBeNull();
    });
  });
});
