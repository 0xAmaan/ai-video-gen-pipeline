import { create } from "zustand";

export type TrackType = "video" | "audio";

export interface Clip {
  id: string;
  trackId: string;
  assetUrl: string;
  name?: string;
  startFrame: number;
  durationInFrames: number;
  maxDurationFrames?: number; // intrinsic media length in frames
  trimStartFrames?: number;
  volume?: number;
  opacity?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  waveform?: number[]; // normalized values 0..1
  thumbnail?: string; // data URL for video thumbnail
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  clips: Clip[];
  muted?: boolean;
  locked?: boolean;
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
  deleteClip: (clipId: string) => void;
}

const demoTrackId = "track-video-1";
const demoClipId = "clip-demo-1";

const computeTimelineDuration = (tracks: Track[], fallback = 0) => {
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
  durationInFrames: 0, // recomputed below
  selectedClipId: null,
  tracks: [
    {
      id: demoTrackId,
      name: "Video",
      type: "video",
      muted: false,
      locked: false,
      clips: [
        {
          id: demoClipId,
          trackId: demoTrackId,
          assetUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          name: "Demo Clip",
          startFrame: 0,
          durationInFrames: 300, // 10s @30fps
          maxDurationFrames: 300,
          trimStartFrames: 0,
          volume: 1,
          fadeInFrames: 10,
          fadeOutFrames: 10,
          opacity: 1,
        },
      ],
    },
    {
      id: "track-audio-1",
      name: "Audio",
      type: "audio",
      muted: false,
      locked: false,
      clips: [],
    },
  ],
};
// Initialize duration based on clips (no minimum)
initialState.durationInFrames = computeTimelineDuration(initialState.tracks, 0);

export const useTimelineStore = create<TimelineState & { actions: TimelineActions }>((set, get) => ({
  ...initialState,
  actions: {
    setTimeline: (timeline) =>
      set((state) => {
        const nextTracks = timeline.tracks ?? state.tracks;
        const durationInFrames =
          timeline.durationInFrames ??
          computeTimelineDuration(nextTracks, 0);
        return { ...state, ...timeline, tracks: nextTracks, durationInFrames };
      }),
    selectClip: (clipId) => set(() => ({ selectedClipId: clipId })),
    updateClip: (clipId, updates) => {
      set((state) => {
        const nextTracks = state.tracks.map((track) => {
          const clips = track.clips.map((clip) => {
            if (clip.id !== clipId) return clip;
            const next = { ...clip, ...updates };
            if (next.maxDurationFrames && next.durationInFrames > next.maxDurationFrames) {
              next.durationInFrames = next.maxDurationFrames;
            }
            return next;
          });
          return { ...track, clips };
        });
        const durationInFrames = computeTimelineDuration(nextTracks, 0);
        return { ...state, tracks: nextTracks, durationInFrames };
      });
    },
    addClip: (trackId, clip) => {
      set((state) => {
        const nextTracks = state.tracks.map((track) =>
          track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track,
        );
        const durationInFrames = computeTimelineDuration(nextTracks, 0);
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

        const durationInFrames = computeTimelineDuration(nextTracks, 0);
        return { ...state, tracks: nextTracks, durationInFrames };
      });
    },
    deleteClip: (clipId) => {
      set((state) => {
        const nextTracks = state.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((c) => c.id !== clipId),
        }));
        const durationInFrames = computeTimelineDuration(nextTracks, 0);
        const nextSelected = state.selectedClipId === clipId ? null : state.selectedClipId;
        return { ...state, tracks: nextTracks, durationInFrames, selectedClipId: nextSelected };
      });
    },
  },
}));
