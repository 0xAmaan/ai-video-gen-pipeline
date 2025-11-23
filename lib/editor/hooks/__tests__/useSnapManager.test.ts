/**
 * Tests for useSnapManager hook - clip-based beat marker extraction
 */

import { renderHook } from "@testing-library/react";
import { useSnapManager } from "../useSnapManager";
import { useProjectStore } from "@/lib/editor/core/project-store";
import type { Project, Clip, MediaAssetMeta } from "@/lib/editor/types";
import type { BeatMarker } from "@/types/audio";

// Mock the project store
jest.mock("@/lib/editor/core/project-store", () => ({
  useProjectStore: jest.fn(),
}));

const mockUseProjectStore = useProjectStore as unknown as jest.Mock;

describe("useSnapManager - Clip-based Beat Extraction", () => {
  const createMockProject = (overrides?: Partial<Project>): Project => ({
    id: "test-project",
    title: "Test Project",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sequences: [
      {
        id: "seq-1",
        name: "Main Sequence",
        width: 1920,
        height: 1080,
        fps: 30,
        sampleRate: 48000,
        duration: 10,
        tracks: [
          {
            id: "audio-1",
            kind: "audio",
            allowOverlap: true,
            locked: false,
            muted: false,
            volume: 1,
            clips: [],
          },
        ],
      },
    ],
    mediaAssets: {},
    settings: {
      snap: true,
      snapToBeats: true,
      snapThreshold: 0.12,
      zoom: 1,
      activeSequenceId: "seq-1",
    },
    ...overrides,
  });

  const createMockAudioAsset = (
    id: string,
    beatMarkers: BeatMarker[],
  ): MediaAssetMeta => ({
    id,
    name: "test-audio.mp3",
    type: "audio",
    duration: 10,
    width: 0,
    height: 0,
    fps: 0,
    url: "https://example.com/audio.mp3",
    beatMarkers,
    bpm: 120,
  });

  const createMockClip = (overrides: Partial<Clip>): Clip => ({
    id: "clip-1",
    mediaId: "asset-1",
    trackId: "audio-1",
    kind: "audio",
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    opacity: 1,
    volume: 1,
    effects: [],
    transitions: [],
    speedCurve: null,
    preservePitch: true,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic beat marker extraction", () => {
    it("should extract beat markers from untrimmed clip at timeline start", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
        { time: 1.0, strength: 1.0 },
        { time: 1.5, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({
        start: 0,
        duration: 2,
        trimStart: 0,
      });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      expect(result.current.beatMarkers).toHaveLength(4);
      expect(result.current.beatMarkers[0].time).toBe(0);
      expect(result.current.beatMarkers[1].time).toBe(0.5);
      expect(result.current.beatMarkers[2].time).toBe(1.0);
      expect(result.current.beatMarkers[3].time).toBe(1.5);
    });

    it("should return empty array when no audio clips exist", () => {
      const project = createMockProject();

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      expect(result.current.beatMarkers).toHaveLength(0);
    });

    it("should return empty array when snapToBeats is disabled", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({ duration: 2 });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
        settings: {
          snap: true,
          snapToBeats: false, // Disabled
          snapThreshold: 0.12,
          zoom: 1,
          activeSequenceId: "seq-1",
        },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      expect(result.current.beatMarkers).toHaveLength(0);
    });
  });

  describe("Trim offset calculations", () => {
    it("should apply trim offset when clip is trimmed from start", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
        { time: 1.0, strength: 1.0 },
        { time: 1.5, strength: 1.0 },
        { time: 2.0, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({
        start: 0,
        duration: 2,
        trimStart: 1.0, // Trimmed 1 second from start
      });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      // Should include beats at 1.0, 1.5, 2.0 from source
      // Transformed to timeline: (1.0 - 1.0) + 0 = 0, (1.5 - 1.0) + 0 = 0.5, (2.0 - 1.0) + 0 = 1.0
      expect(result.current.beatMarkers).toHaveLength(3);
      expect(result.current.beatMarkers[0].time).toBeCloseTo(0, 2);
      expect(result.current.beatMarkers[1].time).toBeCloseTo(0.5, 2);
      expect(result.current.beatMarkers[2].time).toBeCloseTo(1.0, 2);
    });

    it("should filter out beats outside trim range", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
        { time: 1.0, strength: 1.0 },
        { time: 1.5, strength: 1.0 },
        { time: 2.0, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({
        start: 0,
        duration: 0.8,
        trimStart: 0.5,
      });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      // Visible range: 0.5 to 1.3 (0.5 + 0.8)
      // Should include beats at 0.5, 1.0
      expect(result.current.beatMarkers).toHaveLength(2);
    });
  });

  describe("Timeline position offset calculations", () => {
    it("should apply timeline position offset when clip is moved", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
        { time: 1.0, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({
        start: 5.0, // Moved to 5 seconds on timeline
        duration: 1.5,
        trimStart: 0,
      });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      // Beats at 0, 0.5, 1.0 from source → timeline positions: 5.0, 5.5, 6.0
      expect(result.current.beatMarkers).toHaveLength(3);
      expect(result.current.beatMarkers[0].time).toBeCloseTo(5.0, 2);
      expect(result.current.beatMarkers[1].time).toBeCloseTo(5.5, 2);
      expect(result.current.beatMarkers[2].time).toBeCloseTo(6.0, 2);
    });

    it("should handle both trim and position offset", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
        { time: 1.0, strength: 1.0 },
        { time: 1.5, strength: 1.0 },
        { time: 2.0, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({
        start: 3.0, // Timeline position
        duration: 1.5,
        trimStart: 0.5, // Trim from start
      });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      // Visible source range: 0.5 to 2.0
      // Beats: 0.5, 1.0, 1.5, 2.0
      // Timeline positions: (0.5 - 0.5) + 3.0 = 3.0, (1.0 - 0.5) + 3.0 = 3.5, etc.
      expect(result.current.beatMarkers).toHaveLength(4);
      expect(result.current.beatMarkers[0].time).toBeCloseTo(3.0, 2);
      expect(result.current.beatMarkers[1].time).toBeCloseTo(3.5, 2);
      expect(result.current.beatMarkers[2].time).toBeCloseTo(4.0, 2);
      expect(result.current.beatMarkers[3].time).toBeCloseTo(4.5, 2);
    });
  });

  describe("Multiple clips handling", () => {
    it("should combine beats from multiple clips", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
        { time: 1.0, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);

      const clip1 = createMockClip({
        id: "clip-1",
        start: 0,
        duration: 1.5,
        trimStart: 0,
      });

      const clip2 = createMockClip({
        id: "clip-2",
        start: 3.0,
        duration: 1.0,
        trimStart: 0,
      });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip1, clip2];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      // Clip 1: beats at 0, 0.5, 1.0
      // Clip 2: beats at 3.0, 3.5
      expect(result.current.beatMarkers.length).toBeGreaterThan(3);
      
      // Check some specific beats
      const times = result.current.beatMarkers.map(b => b.time);
      expect(times).toContain(0);
      expect(times).toContain(0.5);
      expect(times.some(t => Math.abs(t - 3.0) < 0.01)).toBe(true);
    });

    it("should deduplicate near-identical beats from overlapping clips", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
        { time: 1.0, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);

      // Two clips at the same timeline position
      const clip1 = createMockClip({
        id: "clip-1",
        start: 0,
        duration: 1.5,
        trimStart: 0,
      });

      const clip2 = createMockClip({
        id: "clip-2",
        start: 0,
        duration: 1.5,
        trimStart: 0,
      });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip1, clip2];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      // Should deduplicate beats within 0.01s
      // Without deduplication, would have 6 beats (3 from each clip)
      // With deduplication, should have 3 beats
      expect(result.current.beatMarkers).toHaveLength(3);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty beat markers array in asset", () => {
      const asset = createMockAudioAsset("asset-1", []);
      const clip = createMockClip({ duration: 2 });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      expect(result.current.beatMarkers).toHaveLength(0);
    });

    it("should handle assets without beatMarkers property", () => {
      const asset = createMockAudioAsset("asset-1", []);
      delete (asset as any).beatMarkers;

      const clip = createMockClip({ duration: 2 });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      expect(result.current.beatMarkers).toHaveLength(0);
    });

    it("should ignore non-audio clips", () => {
      const beatMarkers: BeatMarker[] = [{ time: 0, strength: 1.0 }];
      
      const audioAsset = createMockAudioAsset("audio-1", beatMarkers);
      const videoAsset: MediaAssetMeta = {
        ...audioAsset,
        id: "video-1",
        type: "video",
      };

      const clip = createMockClip({
        mediaId: "video-1",
        kind: "video",
      });

      const project = createMockProject({
        mediaAssets: { "video-1": videoAsset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      expect(result.current.beatMarkers).toHaveLength(0);
    });

    it("should handle strength values correctly", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 0.8 },
        { time: 1.0 }, // No strength specified
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({ duration: 1.5 });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      expect(result.current.beatMarkers[0].strength).toBe(1.0);
      expect(result.current.beatMarkers[1].strength).toBe(0.8);
      expect(result.current.beatMarkers[2].strength).toBe(1.0); // Default to 1.0
    });
  });

  describe("BPM calculation", () => {
    it("should calculate BPM from beat markers", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
        { time: 1.0, strength: 1.0 },
        { time: 1.5, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({ duration: 2 });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      expect(result.current.bpm).toBe(120); // 60 / 0.5 = 120 BPM
    });

    it("should return null BPM when insufficient beats", () => {
      const beatMarkers: BeatMarker[] = [{ time: 0, strength: 1.0 }];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({ duration: 1 });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      expect(result.current.bpm).toBeNull();
    });
  });

  describe("Snap functions", () => {
    it("should provide snapToBeats function that works with extracted beats", () => {
      const beatMarkers: BeatMarker[] = [
        { time: 0, strength: 1.0 },
        { time: 0.5, strength: 1.0 },
        { time: 1.0, strength: 1.0 },
      ];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({ duration: 1.5 });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      const snapResult = result.current.snapToBeats(0.52);

      expect(snapResult.snappedTime).toBeCloseTo(0.5, 2);
      expect(snapResult.wasSnapped).toBe(true);
    });

    it("should respect general snap enabled setting", () => {
      const beatMarkers: BeatMarker[] = [{ time: 0, strength: 1.0 }];

      const asset = createMockAudioAsset("asset-1", beatMarkers);
      const clip = createMockClip({ duration: 1 });

      const project = createMockProject({
        mediaAssets: { "asset-1": asset },
        settings: {
          snap: false, // General snap disabled
          snapToBeats: true,
          snapThreshold: 0.12,
          zoom: 1,
          activeSequenceId: "seq-1",
        },
      });
      project.sequences[0].tracks[0].clips = [clip];

      mockUseProjectStore.mockImplementation((selector) =>
        selector({ project, ready: true } as any),
      );

      const { result } = renderHook(() => useSnapManager());

      const snapResult = result.current.snapToBeats(0.05);

      expect(snapResult.wasSnapped).toBe(false);
      expect(snapResult.snappedTime).toBe(0.05);
    });
  });
});
