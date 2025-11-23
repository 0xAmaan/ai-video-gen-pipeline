import { create } from "zustand";

export type TrackType = "video" | "audio";

export interface Clip {
  id: string;
  trackId: string;
  assetUrl: string;
  name?: string;
  startFrame: number;
  durationInFrames: number;
  trimStartFrames?: number;
  volume?: number;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  clips: Clip[];
}

export interface TimelineState {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  tracks: Track[];
  selectedClipId: string | null;
}

interface TimelineActions {
  setTimeline: (timeline: Partial<TimelineState>) => void;
  selectClip: (clipId: string | null) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  addClip: (trackId: string, clip: Clip) => void;
  splitClip: (clipId: string, frame: number) => void;
}

const demoTrackId = "track-video-1";
const demoClipId = "clip-demo-1";

const computeTimelineDuration = (tracks: Track[], fallback = 1800) => {
  const maxEnd = tracks.reduce((max, track) => {
    const trackEnd = track.clips.reduce((cMax, clip) => {
      return Math.max(cMax, clip.startFrame + clip.durationInFrames);
    }, 0);
    return Math.max(max, trackEnd);
  }, 0);
  return Math.max(fallback, maxEnd || fallback);
};

const initialState: TimelineState = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 600, // will be recomputed below
  selectedClipId: null,
  tracks: [
    {
      id: demoTrackId,
      name: "Video",
      type: "video",
      clips: [
        {
          id: demoClipId,
          trackId: demoTrackId,
          assetUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          name: "Demo Clip",
          startFrame: 0,
          durationInFrames: 300, // 10s @30fps
          trimStartFrames: 0,
          volume: 1,
        },
      ],
    },
  ],
};
// Initialize duration based on clips
initialState.durationInFrames = computeTimelineDuration(initialState.tracks, initialState.durationInFrames);

export const useTimelineStore = create<TimelineState & { actions: TimelineActions }>((set, get) => ({
  ...initialState,
  actions: {
    setTimeline: (timeline) =>
      set((state) => {
        const nextTracks = timeline.tracks ?? state.tracks;
        const durationInFrames =
          timeline.durationInFrames ??
          computeTimelineDuration(nextTracks, state.durationInFrames);
        return { ...state, ...timeline, tracks: nextTracks, durationInFrames };
      }),
    selectClip: (clipId) => set(() => ({ selectedClipId: clipId })),
    updateClip: (clipId, updates) => {
      set((state) => {
        const nextTracks = state.tracks.map((track) => {
          const clips = track.clips.map((clip) => (clip.id === clipId ? { ...clip, ...updates } : clip));
          return { ...track, clips };
        });
        const durationInFrames = computeTimelineDuration(nextTracks, state.durationInFrames);
        return { ...state, tracks: nextTracks, durationInFrames };
      });
    },
    addClip: (trackId, clip) => {
      set((state) => {
        const nextTracks = state.tracks.map((track) =>
          track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track,
        );
        const durationInFrames = computeTimelineDuration(nextTracks, state.durationInFrames);
        return { ...state, tracks: nextTracks, durationInFrames };
      });
    },
    splitClip: (clipId, frame) => {
      set((state) => {
        const nextTracks = state.tracks.map((track) => {
          const target = track.clips.find((c) => c.id === clipId);
          if (!target) return track;
          const offset = frame - target.startFrame;
          if (offset <= 0 || offset >= target.durationInFrames) return track;

          const first: Clip = {
            ...target,
            durationInFrames: offset,
          };
          const second: Clip = {
            ...target,
            id: `${target.id}-b`,
            startFrame: target.startFrame + offset,
            durationInFrames: target.durationInFrames - offset,
          };

          const clips = track.clips.flatMap((clip) => (clip.id === clipId ? [first, second] : clip));
          return { ...track, clips };
        });

        const durationInFrames = computeTimelineDuration(nextTracks, state.durationInFrames);
        return { ...state, tracks: nextTracks, durationInFrames };
      });
    },
  },
}));
