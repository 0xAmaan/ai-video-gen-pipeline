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
  clips: [],
});

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
    hydrate: () => Promise<void>;
    refreshTimeline: () => Promise<void>;
    setSelection: (selection: TimelineSelection) => void;
    setZoom: (zoom: number) => void;
    setCurrentTime: (time: number) => void;
    togglePlayback: (playing?: boolean) => void;
    addMediaAsset: (asset: MediaAssetMeta) => void;
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
    hydrate: async () => {
      const snapshot = await ProjectPersistence.load();
      const project = snapshot?.project ?? createProject();
      const history = snapshot?.history ?? { past: [], future: [] };
      await timelineService.setSequence(getSequence(project));
      set({ project, ready: true, history });
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
      const lastClip = track.clips[track.clips.length - 1];
      const start = lastClip ? lastClip.start + lastClip.duration : sequence.duration;
      const clip: Clip = {
        id: `clip-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
        mediaId: asset.id,
        trackId: track.id,
        kind: asset.type === "audio" ? "audio" : asset.type === "image" ? "image" : "video",
        start,
        duration: asset.duration || 1,
        trimStart: 0,
        trimEnd: 0,
        opacity: 1,
        volume: 1,
        effects: [],
        transitions: [],
      };
      track.clips.push(clip);
      sequence.duration = Math.max(sequence.duration, clip.start + clip.duration);
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, state.project!);
      persistLater(snapshot, history);
      set({ project: snapshot, history });
      void timelineService.upsertClip(clip);
    },
    moveClip: (clipId, trackId, start) => {
      const project = get().project;
      if (!project) return;
      const snapshot = deepClone(project);
      const sequence = getSequence(snapshot);
      const clip = findClip(sequence, clipId);
      if (!clip) return;
      clip.trackId = trackId;
      clip.start = start;
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, project);
      persistLater(snapshot, history);
      set({ project: snapshot, history });
      void timelineService.moveClip(clipId, trackId, start);
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
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, project);
      persistLater(snapshot, history);
      set({ project: snapshot, history });
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
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, project);
      persistLater(snapshot, history);
      set({ project: snapshot, history });
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
        break;
      }
      snapshot.updatedAt = Date.now();
      const state = get();
      const history = historyAfterPush(state, project);
      persistLater(snapshot, history);
      set({ project: snapshot, history });
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
