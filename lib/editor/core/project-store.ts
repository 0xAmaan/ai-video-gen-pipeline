"use client";

import { create } from "zustand";
import type {
  Clip,
  MediaAssetMeta,
  Project,
  Sequence,
  TimelineSelection,
  Track,
} from "../types";

const MAX_HISTORY = 50;

interface PersistedHistory {
  past: Project[];
  future: Project[];
}

// Type for the Convex save function (injected from component)
type SaveProjectFn = (args: {
  projectId?: string;
  projectData: Project;
}) => Promise<any>;

type SaveHistorySnapshotFn = (args: {
  projectId: string;
  snapshot: Project;
  historyType: "past" | "future";
}) => Promise<any>;

type ClearFutureHistoryFn = (args: { projectId: string }) => Promise<any>;

type LoadProjectFn = (args: { projectId?: string }) => Promise<{
  project: Project;
} | null>;

type LoadProjectHistoryFn = (args: {
  projectId: string;
  historyType: "past" | "future";
  limit?: number;
}) => Promise<Project[]>;

const deepClone = <T>(value: T): T => {
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

const sortTrackClips = (track: Track) => {
  track.clips.sort((a, b) => a.start - b.start);
};

const recalculateSequenceDuration = (sequence: Sequence) => {
  const duration = sequence.tracks.reduce((max, track) => {
    const trackEnd = track.clips.reduce(
      (trackMax, clip) => Math.max(trackMax, clip.start + clip.duration),
      0,
    );
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
      zoom: 1,
      activeSequenceId: sequence.id,
    },
  };
};

// Debounced save to Convex (now only saves project, not history)
const createPersistLater = (saveProject: SaveProjectFn | null) => {
  let timer: number | undefined;
  return (project: Project) => {
    if (typeof window === "undefined" || !saveProject) return;
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      void saveProject({
        projectId: project.id,
        projectData: project,
      });
    }, 2000); // 2 second debounce (increased to reduce writes)
  };
};

interface HistoryState extends PersistedHistory {}

const historyAfterPush = (
  state: ProjectStoreState,
  project: Project,
): HistoryState => {
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
  sequence.tracks
    .flatMap((track) => track.clips)
    .find((clip) => clip.id === clipId);

export interface ProjectStoreState {
  ready: boolean;
  project: Project | null;
  selection: TimelineSelection;
  isPlaying: boolean;
  currentTime: number;
  history: HistoryState;
  // Convex functions injected from component
  _saveProject: SaveProjectFn | null;
  _saveHistorySnapshot: SaveHistorySnapshotFn | null;
  _clearFutureHistory: ClearFutureHistoryFn | null;
  _loadProject: LoadProjectFn | null;
  _loadProjectHistory: LoadProjectHistoryFn | null;
  actions: {
    setSaveProject: (fn: SaveProjectFn) => void;
    setSaveHistorySnapshot: (fn: SaveHistorySnapshotFn) => void;
    setClearFutureHistory: (fn: ClearFutureHistoryFn) => void;
    setLoadProject: (fn: LoadProjectFn) => void;
    setLoadProjectHistory: (fn: LoadProjectHistoryFn) => void;
    hydrate: () => Promise<void>;
    reset: () => void;
    loadProject: (
      project: Project,
      options?: { history?: PersistedHistory; persist?: boolean },
    ) => Promise<void>;
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
    reorderClips: (clips: Clip[]) => void;
    setClipVolume: (clipId: string, volume: number) => void;
    toggleTrackMute: (trackId: string) => void;
    undo: () => void;
    redo: () => void;
  };
}

export const useProjectStore = create<ProjectStoreState>((set, get) => {
  // Helper to persist project changes (now only saves project, not history)
  const persist = (project: Project) => {
    const state = get();
    if (state._saveProject) {
      const persistLater = createPersistLater(state._saveProject);
      persistLater(project);
    }
  };

  // Helper to persist history snapshot
  const persistHistorySnapshot = (
    projectId: string,
    snapshot: Project,
    historyType: "past" | "future",
  ) => {
    const state = get();
    if (state._saveHistorySnapshot) {
      void state._saveHistorySnapshot({ projectId, snapshot, historyType });
    }
  };

  return {
    ready: false,
    project: null,
    selection: { clipIds: [], trackIds: [] },
    isPlaying: false,
    currentTime: 0,
    history: { past: [], future: [] },
    _saveProject: null,
    _saveHistorySnapshot: null,
    _clearFutureHistory: null,
    _loadProject: null,
    _loadProjectHistory: null,
    actions: {
      setSaveProject: (fn) => set({ _saveProject: fn }),
      setSaveHistorySnapshot: (fn) => set({ _saveHistorySnapshot: fn }),
      setClearFutureHistory: (fn) => set({ _clearFutureHistory: fn }),
      setLoadProject: (fn) => set({ _loadProject: fn }),
      setLoadProjectHistory: (fn) => set({ _loadProjectHistory: fn }),
      hydrate: async () => {
        const state = get();
        if (!state._loadProject || !state._loadProjectHistory) {
          // No Convex yet, create new project
          const project = createProject();
          const history = { past: [], future: [] };
          set({ project, ready: true, history });
          return;
        }

        try {
          const snapshot = await state._loadProject({});
          if (snapshot?.project) {
            // Load history separately (only load last 10 for initial hydration)
            const [past, future] = await Promise.all([
              state._loadProjectHistory({
                projectId: snapshot.project.id,
                historyType: "past",
                limit: 10,
              }),
              state._loadProjectHistory({
                projectId: snapshot.project.id,
                historyType: "future",
                limit: 10,
              }),
            ]);

            set({
              project: snapshot.project,
              history: { past, future },
              ready: true,
            });
          } else {
            // No saved project, create new
            const project = createProject();
            const history = { past: [], future: [] };
            set({ project, ready: true, history });
          }
        } catch (error) {
          console.error("Failed to load project from Convex:", error);
          // Fallback to new project
          const project = createProject();
          const history = { past: [], future: [] };
          set({ project, ready: true, history });
        }
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
        const state = get();
        const snapshot = deepClone(project);
        const history = options?.history ?? { past: [], future: [] };
        set({
          project: snapshot,
          ready: true,
          history,
          selection: { clipIds: [], trackIds: [] },
          currentTime: 0,
          isPlaying: false,
        });
        if (options?.persist !== false) {
          persist(snapshot);
        }
      },
      refreshTimeline: async () => {
        // No-op - timeline service removed
      },
      setSelection: (selection) => set({ selection }),
      setZoom: (zoom) =>
        set((state) => ({
          project: state.project
            ? {
                ...state.project,
                settings: { ...state.project.settings, zoom },
              }
            : state.project,
        })),
      setCurrentTime: (time) => set({ currentTime: time }),
      togglePlayback: (playing) =>
        set((state) => ({
          isPlaying: typeof playing === "boolean" ? playing : !state.isPlaying,
        })),
      addMediaAsset: (asset) =>
        set((state) => {
          if (!state.project) return state;
          const next = deepClone(state.project);
          next.mediaAssets[asset.id] = asset;
          next.updatedAt = Date.now();
          const history = historyAfterPush(state, state.project);
          persist(next);
          // Save history snapshot separately
          if (state.project) {
            persistHistorySnapshot(next.id, state.project, "past");
          }
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
          kind:
            asset.type === "audio"
              ? "audio"
              : asset.type === "image"
                ? "image"
                : "video",
          start,
          duration: clipDuration,
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
        };
        track.clips.push(clip);
        sortTrackClips(track);
        const duration = recalculateSequenceDuration(sequence);
        snapshot.updatedAt = Date.now();
        const state = get();
        const history = historyAfterPush(state, state.project!);
        persist(snapshot);
        if (state.project) {
          persistHistorySnapshot(snapshot.id, state.project, "past");
        }
        set((current) => ({
          project: snapshot,
          history,
          currentTime: Math.min(current.currentTime, duration),
        }));
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
        persist(snapshot);
        persistHistorySnapshot(snapshot.id, project, "past");
        set((current) => ({
          project: snapshot,
          history,
          currentTime: Math.min(current.currentTime, duration),
        }));
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
        persist(snapshot);
        persistHistorySnapshot(snapshot.id, project, "past");
        set((current) => ({
          project: snapshot,
          history,
          currentTime: Math.min(current.currentTime, duration),
        }));
      },
      splitClip: (clipId, offset) => {
        const project = get().project;
        if (!project) return;
        const snapshot = deepClone(project);
        const sequence = getSequence(snapshot);
        const track = sequence.tracks.find((t) =>
          t.clips.some((clip) => clip.id === clipId),
        );
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
        persist(snapshot);
        persistHistorySnapshot(snapshot.id, project, "past");
        set((current) => ({
          project: snapshot,
          history,
          currentTime: Math.min(current.currentTime, duration),
        }));
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
        persist(snapshot);
        persistHistorySnapshot(snapshot.id, project, "past");
        set((current) => ({
          project: snapshot,
          history,
          currentTime: Math.min(current.currentTime, duration),
        }));
      },
      setClipVolume: (clipId, volume) => {
        set((state) => {
          if (!state.project) return state;
          const snapshot = deepClone(state.project);
          const sequence = getSequence(snapshot);
          const clip = findClip(sequence, clipId);
          if (!clip) return state;
          clip.volume = Math.max(0, Math.min(1, volume));
          snapshot.updatedAt = Date.now();
          const history = historyAfterPush(state, state.project);
          persist(snapshot);
          persistHistorySnapshot(snapshot.id, state.project, "past");
          return { ...state, project: snapshot, history };
        });
      },
      toggleTrackMute: (trackId) => {
        set((state) => {
          if (!state.project) return state;
          const snapshot = deepClone(state.project);
          const sequence = getSequence(snapshot);
          const track = sequence.tracks.find((t) => t.id === trackId);
          if (!track) return state;
          track.muted = !track.muted;
          snapshot.updatedAt = Date.now();
          const history = historyAfterPush(state, state.project);
          persist(snapshot);
          persistHistorySnapshot(snapshot.id, state.project, "past");
          return { ...state, project: snapshot, history };
        });
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
          persist(previous);
          // Save current state to future history
          if (state.project && state._clearFutureHistory) {
            void state._clearFutureHistory({ projectId: previous.id });
          }
          if (state.project) {
            persistHistorySnapshot(previous.id, state.project, "future");
          }
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
          persist(next);
          // Save current state to past history
          if (state.project) {
            persistHistorySnapshot(next.id, state.project, "past");
          }
          return { ...state, project: next, history };
        }),
      reorderClips: (clips: Clip[]) => {
        const project = get().project;
        if (!project) return;
        const snapshot = deepClone(project);
        const sequence = getSequence(snapshot);
        const videoTrack = sequence.tracks.find((t) => t.kind === "video");
        if (!videoTrack) return;

        // Replace all clips on the video track with the reordered clips
        videoTrack.clips = clips;
        sortTrackClips(videoTrack);

        const duration = recalculateSequenceDuration(sequence);
        snapshot.updatedAt = Date.now();
        const state = get();
        const history = historyAfterPush(state, project);
        persist(snapshot);
        persistHistorySnapshot(snapshot.id, project, "past");
        set((current) => ({
          project: snapshot,
          history,
          currentTime: Math.min(current.currentTime, duration),
        }));
      },
    },
  };
});
