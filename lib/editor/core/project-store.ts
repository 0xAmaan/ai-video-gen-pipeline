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
import { HistoryManager } from "../history/HistoryManager";
import {
  ClipMoveCommand,
  ClipSplitCommand,
  ClipDeleteCommand,
  ClipTrimCommand,
  ClipAddCommand,
  RippleTrimCommand,
  SlipEditCommand,
  SlideEditCommand,
  RippleDeleteCommand,
} from "../history/commands";

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
      snapToBeats: true,
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
  history: HistoryState; // Legacy snapshot-based history (deprecated)
  historyManager: HistoryManager; // New command-based history system

  // Tri-State Architecture (PRD Section 5.2)
  dirty: boolean; // Has unsaved changes in session state
  lastSavedSignature: string | null; // Hash of last persisted state

  // Editor modes
  rippleEditEnabled: boolean;
  multiTrackRipple: boolean; // When true, ripple affects all unlocked tracks

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
    rippleTrim: (clipId: string, trimStart: number, trimEnd: number) => void;
    slipEdit: (clipId: string, offset: number) => void;
    slideEdit: (clipId: string, newStart: number) => void;
    splitClip: (clipId: string, offset: number) => void;
    splitAtPlayhead: (clipId: string) => void;
    deleteClip: (clipId: string) => void;
    rippleDelete: (clipId: string) => void;
    undo: () => void;
    redo: () => void;
    save: () => Promise<void>; // Explicit save to Convex (PRD Tri-State)
    markDirty: () => void; // Mark session as dirty without persisting
    toggleRippleEdit: () => void;
    toggleMultiTrackRipple: () => void;
  };
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  ready: false,
  project: null,
  selection: { clipIds: [], trackIds: [] },
  isPlaying: false,
  currentTime: 0,
  history: { past: [], future: [] }, // Legacy (deprecated)
  historyManager: new HistoryManager({
    maxDepth: 50,
    onChange: (manager) => {
      // Mark as dirty when history changes
      set({ dirty: true });
    },
  }),

  // Tri-State Architecture (PRD Section 5.2)
  dirty: false,
  lastSavedSignature: null,

  // Editor modes
  rippleEditEnabled: false,
  multiTrackRipple: false, // Default to single-track ripple

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
      
      const signature = JSON.stringify(snapshot);
      set({
        project: snapshot,
        ready: true,
        history,
        selection: { clipIds: [], trackIds: [] },
        currentTime: 0,
        isPlaying: false,
        dirty: false, // Fresh load is not dirty
        lastSavedSignature: signature,
      });
      
      // Optionally persist immediately on load
      if (options?.persist !== false) {
        await ProjectPersistence.save({ project: snapshot, history });
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
        return { ...state, project: next, history, dirty: true };
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
        return { ...state, project: next, history, dirty: true };
      }),
    appendClipFromAsset: (assetId) => {
      const project = get().project;
      if (!project) return;
      const asset = project.mediaAssets[assetId];
      if (!asset) return;

      const sequence = getSequence(project);
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

      const state = get();
      const { historyManager } = state;

      const command = new ClipAddCommand(
        () => get().project,
        (project) => {
          set({ project, dirty: true });
          void timelineService.setSequence(getSequence(project));
        },
        clip,
        track.id,
      );

      const success = historyManager.execute(command);
      if (success) {
        void timelineService.upsertClip(clip);
      }
    },
    moveClip: (clipId, trackId, start) => {
      const state = get();
      const { historyManager } = state;

      const command = new ClipMoveCommand(
        () => get().project,
        (project) => {
          set({ project, dirty: true });
          void timelineService.setSequence(getSequence(project));
        },
        clipId,
        trackId,
        start,
      );

      const success = historyManager.execute(command);
      if (success) {
        void timelineService.moveClip(clipId, trackId, start);
      }
    },
    trimClip: (clipId, trimStart, trimEnd) => {
      const state = get();
      const { historyManager } = state;

      const command = new ClipTrimCommand(
        () => get().project,
        (project) => {
          set({ project, dirty: true });
          void timelineService.setSequence(getSequence(project));
        },
        clipId,
        trimStart,
        trimEnd,
      );

      const success = historyManager.execute(command);
      if (success) {
        void timelineService.trimClip(clipId, trimStart, trimEnd);
      }
    },
    rippleTrim: (clipId, trimStart, trimEnd) => {
      const state = get();
      const { historyManager } = state;

      const command = new RippleTrimCommand(
        () => get().project,
        (project) => {
          set({ project, dirty: true });
          void timelineService.setSequence(getSequence(project));
        },
        clipId,
        trimStart,
        trimEnd,
      );

      const success = historyManager.execute(command);
      if (success) {
        void timelineService.trimClip(clipId, trimStart, trimEnd);
      }
    },
    slipEdit: (clipId, offset) => {
      const state = get();
      const { historyManager } = state;

      const command = new SlipEditCommand(
        () => get().project,
        (project) => {
          set({ project, dirty: true });
          void timelineService.setSequence(getSequence(project));
        },
        clipId,
        offset,
      );

      const success = historyManager.execute(command);
      if (success && get().project) {
        // Calculate actual offset for timeline service sync
        const project = get().project!;
        const sequence = getSequence(project);
        const clip = findClip(sequence, clipId);
        if (clip) {
          const asset = project.mediaAssets[clip.mediaId];
          if (asset) {
            const newTrimStart = clip.trimStart;
            void timelineService.trimClip(clipId, offset, -offset);
          }
        }
      }
    },
    slideEdit: (clipId, newStart) => {
      const state = get();
      const { historyManager } = state;

      const command = new SlideEditCommand(
        () => get().project,
        (project) => {
          set({ project, dirty: true });
          void timelineService.setSequence(getSequence(project));
        },
        clipId,
        newStart,
      );

      const success = historyManager.execute(command);
      if (success && get().project) {
        const project = get().project!;
        const sequence = getSequence(project);
        const result = findTrackAndClip(sequence, clipId);
        if (result) {
          void timelineService.moveClip(clipId, result.track.id, result.clip.start);
        }
      }
    },
    splitClip: (clipId, offset) => {
      const state = get();
      const { historyManager } = state;

      const command = new ClipSplitCommand(
        () => get().project,
        (project) => {
          set({ project, dirty: true });
          void timelineService.setSequence(getSequence(project));
        },
        clipId,
        offset,
      );

      const success = historyManager.execute(command);
      if (success) {
        void timelineService.splitClip(clipId, offset);
      }
    },
    splitAtPlayhead: (clipId) => {
      const state = get();
      const project = state.project;
      if (!project) return;
      
      const currentTime = state.currentTime;
      const sequence = getSequence(project);
      
      // Find the clip to split
      let targetClip: Clip | undefined;
      for (const track of sequence.tracks) {
        targetClip = track.clips.find((clip) => clip.id === clipId);
        if (targetClip) break;
      }
      
      if (!targetClip) {
        console.warn('[ProjectStore] splitAtPlayhead: clip not found:', clipId);
        return;
      }
      
      // Calculate offset from clip start
      const offset = currentTime - targetClip.start;
      
      // Validate that playhead is within clip bounds
      if (offset <= 0 || offset >= targetClip.duration) {
        console.warn('[ProjectStore] splitAtPlayhead: playhead not within clip bounds', {
          clipId,
          clipStart: targetClip.start,
          clipDuration: targetClip.duration,
          playhead: currentTime,
          offset,
        });
        return;
      }
      
      // Use existing splitClip implementation
      get().actions.splitClip(clipId, offset);
    },
    deleteClip: (clipId) => {
      const state = get();
      const { historyManager } = state;

      const command = new ClipDeleteCommand(
        () => get().project,
        (project) => {
          set({ project, dirty: true });
          void timelineService.setSequence(getSequence(project));
        },
        clipId,
      );

      const success = historyManager.execute(command);
      if (success) {
        void timelineService.deleteClip(clipId);
      }
    },
    rippleDelete: (clipId) => {
      const state = get();
      const { historyManager, multiTrackRipple } = state;

      const command = new RippleDeleteCommand(
        () => get().project,
        (project) => {
          set({ project, dirty: true });
          void timelineService.setSequence(getSequence(project));
        },
        clipId,
        multiTrackRipple, // Pass multi-track ripple setting
      );

      const success = historyManager.execute(command);
      if (success) {
        void timelineService.rippleDelete(clipId);
      }
    },
    undo: () => {
      const { historyManager } = get();
      const success = historyManager.undo();
      if (success) {
        console.log("[History] Undo:", historyManager.getUndoDescription());
      }
    },
    redo: () => {
      const { historyManager } = get();
      const success = historyManager.redo();
      if (success) {
        console.log("[History] Redo:", historyManager.getRedoDescription());
      }
    },
    
    // Tri-State Architecture: Explicit save (PRD Section 5.2)
    save: async () => {
      const { project, history, dirty } = get();
      if (!project || !dirty) return;
      
      await ProjectPersistence.save({ project, history });
      
      const signature = JSON.stringify(project);
      set({ dirty: false, lastSavedSignature: signature });
    },
    
    // Mark session state as dirty without triggering persistence
    markDirty: () => set({ dirty: true }),

    // Toggle ripple edit mode
    toggleRippleEdit: () => set((state) => ({ rippleEditEnabled: !state.rippleEditEnabled })),
    
    // Toggle multi-track ripple mode
    toggleMultiTrackRipple: () => set((state) => ({ multiTrackRipple: !state.multiTrackRipple })),
  },
}));

export const useEditorStore = useProjectStore;

// Auto-save interval (PRD Section 5.2: Tri-State Architecture)
// Saves dirty state to Convex every 5 seconds
if (typeof window !== "undefined") {
  setInterval(() => {
    const state = useProjectStore.getState();
    if (state.dirty && state.project) {
      void state.actions.save();
    }
  }, 5000); // 5 second auto-save
}
