"use client";

import { create } from "zustand";
import { timelineService } from "./timeline-service";
import type {
  Clip,
  MediaAssetMeta,
  Project,
  Sequence,
  TimelineSelection,
  Track,
} from "../types";
import { PersistedHistory, ProjectPersistence } from "./persistence";

const MAX_HISTORY = 50;

const deepClone = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const createTrack = (id: string, kind: Track["kind"]): Track => ({
  id,
  kind,
  allowOverlap: kind !== "video",
  locked: false,
  muted: false,
  volume: 1,
  clips: [],
});

const sortTrackClips = (track: Track) => {
  track.clips.sort((a, b) => a.start - b.start);
};

const recalculateSequenceDuration = (sequence: Sequence) => {
  const duration = sequence.tracks.reduce((max, track) => {
    const trackEnd = track.clips.reduce((trackMax, clip) => Math.max(trackMax, clip.start + clip.duration), 0);
    return Math.max(max, trackEnd);
  }, 0);
  sequence.duration = duration;
  return duration;
};

const findTrackInsertionStart = (track: Track, duration: number) => {
  if (!track.clips.length) {
    return 0;
  }
  const sorted = [...track.clips].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const clip of sorted) {
    if (cursor + duration <= clip.start) {
      return cursor;
    }
    cursor = Math.max(cursor, clip.start + clip.duration);
  }
  return cursor;
};

const findTrackAndClip = (sequence: Sequence, clipId: string) => {
  for (const track of sequence.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) {
      return { track, clip } as const;
    }
  }
  return null;
};

const createSequence = (): Sequence => ({
  id: `sequence-${crypto.randomUUID?.() ?? Date.now().toString(36)}`,
  name: "Main Sequence",
  width: 1920,
  height: 1080,
  fps: 30,
  sampleRate: 48000,
  duration: 0,
  tracks: [createTrack("video-1", "video"), createTrack("audio-1", "audio")],
});

const createProject = (): Project => {
  const sequence = createSequence();
  return {
    id: crypto.randomUUID?.() ?? `project-${Date.now()}`,
    title: "Untitled Project",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sequences: [sequence],
    mediaAssets: {},
    settings: {
      snap: true,
      snapThreshold: 0.1,
      zoom: 1,
      activeSequenceId: sequence.id,
    },
  };
};

const persistLater = (() => {
  let timer: number | undefined;
  return (project: Project, history: PersistedHistory) => {
    if (typeof window === "undefined") return;
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      void ProjectPersistence.save({ project, history });
    }, 300);
  };
})();

interface HistoryState extends PersistedHistory {}

const historyAfterPush = (state: ProjectStoreState, project: Project): HistoryState => {
  const snapshot = deepClone(project);
  const history: HistoryState = {
    past: [...state.history.past, snapshot],
    future: [],
  };
  if (history.past.length > MAX_HISTORY) {
    history.past.shift();
  }
  return history;
};

const getSequence = (project: Project): Sequence => {
  const sequence = project.sequences.find(
    (seq) => seq.id === project.settings.activeSequenceId,
  );
  if (!sequence) {
    throw new Error("Active sequence not found");
  }
  return sequence;
};

const findClip = (sequence: Sequence, clipId: string): Clip | undefined =>
  sequence.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);

export interface ProjectStoreState {
  ready: boolean;
  project: Project | null;
  selection: TimelineSelection;
  isPlaying: boolean;
  currentTime: number;
  history: HistoryState;
  actions: {
    hydrate: (projectId?: string) => Promise<void>;
    reset: () => void;
    loadProject: (project: Project, options?: { history?: PersistedHistory; persist?: boolean }) => Promise<void>;
    refreshTimeline: () => Promise<void>;
    setSelection: (selection: TimelineSelection) => void;
    setZoom: (zoom: number) => void;
    setCurrentTime: (time: number) => void;
    togglePlayback: (playing?: boolean) => void;
    addMediaAsset: (asset: MediaAssetMeta) => void;
    updateMediaAsset: (assetId: string, updates: Partial<MediaAssetMeta>) => void;
    appendClipFromAsset: (assetId: string) => void;
    moveClip: (clipId: string, trackId: string, start: number) => void;
    trimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
    splitClip: (clipId: string, offset: number) => void;
    rippleDelete: (clipId: string) => void;
    undo: () => void;
    redo: () => void;
  };
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  ready: false,
  project: null,
  selection: { clipIds: [], trackIds: [] },
  isPlaying: false,
  currentTime: 0,
  history: { past: [], future: [] },
  actions: {
    hydrate: async (projectId?: string) => {
      const snapshot = await ProjectPersistence.load(projectId);
      const project = snapshot?.project ?? createProject();
      const history = snapshot?.history ?? { past: [], future: [] };
      await timelineService.setSequence(getSequence(project));
      set({ project, ready: true, history });
    },
    reset: () =>
      set({
        ready: false,
        project: null,
        selection: { clipIds: [], trackIds: [] },
        isPlaying: false,
        currentTime: 0,
        history: { past: [], future: [] },
      }),
    loadProject: async (project, options) => {
      const snapshot = deepClone(project);
      const history = options?.history ?? { past: [], future: [] };
      await timelineService.setSequence(getSequence(snapshot));
      set({
        project: snapshot,
        ready: true,
        history,
        selection: { clipIds: [], trackIds: [] },
        currentTime: 0,
        isPlaying: false,
      });
      if (options?.persist !== false) {
        persistLater(snapshot, history);
      }
    },
    refreshTimeline: async () => {
      const project = get().project;
      if (!project) return;
      await timelineService.setSequence(getSequence(project));
    },
    setSelection: (selection) => set({ selection }),
    setZoom: (zoom) =>
      set((state) => ({
        project: state.project
          ? { ...state.project, settings: { ...state.project.settings, zoom } }
          : state.project,
      })),
    setCurrentTime: (time) => set({ currentTime: time }),
    togglePlayback: (playing) =>
      set((state) => ({ isPlaying: typeof playing === "boolean" ? playing : !state.isPlaying })),
    addMediaAsset: (asset) =>
      set((state) => {
        if (!state.project) return state;
        const next = deepClone(state.project);
        next.mediaAssets[asset.id] = asset;
        next.updatedAt = Date.now();
        const history = historyAfterPush(state, state.project);
        persistLater(next, history);
        return { ...state, project: next, history };
      }),
    updateMediaAsset: (assetId, updates) =>
      set((state) => {
        if (!state.project) return state;
        const existing = state.project.mediaAssets[assetId];
        if (!existing) return state;
        const next = deepClone(state.project);
        next.mediaAssets[assetId] = { ...existing, ...updates };
        next.updatedAt = Date.now();
        const history = historyAfterPush(state, state.project);
        persistLater(next, history);
        return { ...state, project: next, history };
      }),
    appendClipFromAsset: (assetId) => {
      const project = get().project;
      if (!project) return;
      const asset = project.mediaAssets[assetId];
      if (!asset) return;
      const snapshot = deepClone(project);
      const sequence = getSequence(snapshot);
      const track = sequence.tracks.find((t) =>
        asset.type === "audio" ? t.kind === "audio" : t.kind === "video",
      );
      if (!track) return;
      const clipDuration = asset.duration || 1;
      const start = findTrackInsertionStart(track, clipDuration);
      const clip: Clip = {
        id: `clip-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
        mediaId: asset.id,
        trackId: track.id,
        kind: asset.type === "audio" ? "audio" : asset.type === "image" ? "image" : "video",
        start,
        duration: clipDuration,
        trimStart: 0,
        trimEnd: 0,
        opacity: 1,
        volume: 1,
        effects: [],
        transitions: [],
        speedCurve: null,
        preservePitch: true,
      };
      track.clips.push(clip);
      sortTrackClips(track);
      const duration = recalculateSequenceDuration(sequence);
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, state.project!);
      persistLater(snapshot, history);
      set((current) => ({ project: snapshot, history, currentTime: Math.min(current.currentTime, duration) }));
      void timelineService.upsertClip(clip);
    },
    moveClip: (clipId, trackId, start) => {
      const project = get().project;
      if (!project) return;
      const snapshot = deepClone(project);
      const sequence = getSequence(snapshot);
      const located = findTrackAndClip(sequence, clipId);
      if (!located) return;
      const { track: currentTrack, clip } = located;
      const targetTrack = sequence.tracks.find((t) => t.id === trackId);
      if (!targetTrack) return;
      const nextStart = Math.max(0, start);
      if (currentTrack.id !== targetTrack.id) {
        const index = currentTrack.clips.findIndex((c) => c.id === clipId);
        if (index !== -1) {
          currentTrack.clips.splice(index, 1);
        }
        targetTrack.clips.push(clip);
      }
      clip.trackId = trackId;
      clip.start = nextStart;
      sortTrackClips(targetTrack);
      const duration = recalculateSequenceDuration(sequence);
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, project);
      persistLater(snapshot, history);
      set((current) => ({ project: snapshot, history, currentTime: Math.min(current.currentTime, duration) }));
      void timelineService.moveClip(clipId, trackId, nextStart);
    },
    trimClip: (clipId, trimStart, trimEnd) => {
      const project = get().project;
      if (!project) return;
      const snapshot = deepClone(project);
      const sequence = getSequence(snapshot);
      const clip = findClip(sequence, clipId);
      if (!clip) return;
      clip.trimStart += trimStart;
      clip.trimEnd += trimEnd;
      clip.duration = Math.max(0.1, clip.duration - trimStart - trimEnd);
      const duration = recalculateSequenceDuration(sequence);
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, project);
      persistLater(snapshot, history);
      set((current) => ({ project: snapshot, history, currentTime: Math.min(current.currentTime, duration) }));
      void timelineService.trimClip(clipId, trimStart, trimEnd);
    },
    splitClip: (clipId, offset) => {
      const project = get().project;
      if (!project) return;
      const snapshot = deepClone(project);
      const sequence = getSequence(snapshot);
      const track = sequence.tracks.find((t) => t.clips.some((clip) => clip.id === clipId));
      if (!track) return;
      const index = track.clips.findIndex((clip) => clip.id === clipId);
      if (index === -1) return;
      const clip = track.clips[index];
      const right: Clip = {
        ...clip,
        id: `${clip.id}_b`,
        start: clip.start + offset,
        duration: Math.max(0.1, clip.duration - offset),
        trimStart: clip.trimStart + offset,
      };
      clip.duration = offset;
      clip.trimEnd = Math.max(0, clip.trimEnd - right.duration);
      track.clips.splice(index + 1, 0, right);
      sortTrackClips(track);
      const duration = recalculateSequenceDuration(sequence);
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, project);
      persistLater(snapshot, history);
      set((current) => ({ project: snapshot, history, currentTime: Math.min(current.currentTime, duration) }));
      void timelineService.splitClip(clipId, offset);
    },
    rippleDelete: (clipId) => {
      const project = get().project;
      if (!project) return;
      const snapshot = deepClone(project);
      const sequence = getSequence(snapshot);
      for (const track of sequence.tracks) {
        const index = track.clips.findIndex((clip) => clip.id === clipId);
        if (index === -1) {
          continue;
        }
        const removed = track.clips[index];
        track.clips.splice(index, 1);
        track.clips.forEach((clip) => {
          if (clip.start > removed.start) {
            clip.start = Math.max(0, clip.start - removed.duration);
          }
        });
        sortTrackClips(track);
        break;
      }
      const duration = recalculateSequenceDuration(sequence);
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, project);
      persistLater(snapshot, history);
      set((current) => ({ project: snapshot, history, currentTime: Math.min(current.currentTime, duration) }));
      void timelineService.rippleDelete(clipId);
    },
    undo: () =>
      set((state) => {
        if (!state.history.past.length) return state;
        const past = [...state.history.past];
        const previous = past.pop()!;
        const future = state.project
          ? [deepClone(state.project), ...state.history.future]
          : [...state.history.future];
        const history = { past, future };
        persistLater(previous, history);
        void timelineService.setSequence(getSequence(previous));
        return { ...state, project: previous, history };
      }),
    redo: () =>
      set((state) => {
        if (!state.history.future.length) return state;
        const [next, ...rest] = state.history.future;
        const past = state.project
          ? [...state.history.past, deepClone(state.project)]
          : [...state.history.past];
        const history = { past, future: rest };
        persistLater(next, history);
        void timelineService.setSequence(getSequence(next));
        return { ...state, project: next, history };
      }),
  },
}));

export const useEditorStore = useProjectStore;
