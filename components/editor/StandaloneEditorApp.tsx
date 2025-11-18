"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { getMediaBunnyManager } from "@/lib/editor/io/media-bunny-manager";
import { PreviewRenderer } from "@/lib/editor/playback/preview-renderer";
import { getExportPipeline } from "@/lib/editor/export/export-pipeline";
import { saveBlob } from "@/lib/editor/export/save-file";
import { TopBar } from "@/components/editor/TopBar";
import { MediaPanel } from "@/components/editor/MediaPanel";
import { PreviewPanel } from "@/components/editor/PreviewPanel";
import { KonvaTimeline } from "@/components/editor/KonvaTimeline";
import { TransitionLibrary } from "@/components/editor/TransitionLibrary";
import { FilterLibrary } from "@/components/editor/FilterLibrary";
import { SpeedControlPanel } from "@/components/editor/SpeedControlPanel";
import { ExportModal } from "@/components/ExportModal";
import { ConfirmDeleteDialog } from "@/components/editor/ConfirmDeleteDialog";
import { ClipContextMenu } from "@/components/editor/ClipContextMenu";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MediaAssetMeta, TransitionSpec, Effect } from "@/lib/editor/types";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Waves } from "lucide-react";
import type { BeatMarker } from "@/types/audio";
import { TRANSITION_PRESETS } from "@/lib/editor/transitions";
import { FILTER_PRESETS } from "@/lib/editor/filters";

const NARRATION_TRACK_ID = "audio-narration";
const BGM_TRACK_ID = "audio-bgm";
const SFX_TRACK_ID = "audio-sfx";
const TRACK_LABELS: Record<string, string> = {
  [NARRATION_TRACK_ID]: "Narration",
  [BGM_TRACK_ID]: "Background Music",
  [SFX_TRACK_ID]: "Sound Effects",
};
const PERSISTABLE_AUDIO_TRACK_IDS = [
  NARRATION_TRACK_ID,
  BGM_TRACK_ID,
  SFX_TRACK_ID,
] as const;
type PersistableAudioTrackId =
  (typeof PERSISTABLE_AUDIO_TRACK_IDS)[number];
const isPersistableAudioTrack = (
  trackId: string,
): trackId is PersistableAudioTrackId =>
  (PERSISTABLE_AUDIO_TRACK_IDS as readonly string[]).includes(trackId);

const MAX_ANALYSIS_DURATION_SECONDS = 300;
const ENERGY_HISTORY_SIZE = 43;
const ENERGY_SENSITIVITY = 1.35;
const MAX_BEATS_TRACKED = 512;
const MIN_BEAT_INTERVAL = 0.2;
const MAX_BEAT_INTERVAL = 2.5;

type AudioContextConstructor = typeof window.AudioContext;

const getAudioContextConstructor = (): AudioContextConstructor | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const win = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

const deriveBpmFromBeats = (beats: BeatMarker[]) => {
  if (beats.length < 2) return undefined;
  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    const delta = beats[i].time - beats[i - 1].time;
    if (delta >= MIN_BEAT_INTERVAL && delta <= MAX_BEAT_INTERVAL) {
      intervals.push(delta);
    }
  }
  if (intervals.length === 0) return undefined;
  const medianInterval = median(intervals);
  const bpm = 60 / medianInterval;
  return Number.isFinite(bpm) && bpm > 0 ? bpm : undefined;
};

const extractBeatMarkers = (buffer: AudioBuffer) => {
  const sampleRate = buffer.sampleRate || 44100;
  const maxSamples = Math.min(
    buffer.length,
    Math.round(sampleRate * MAX_ANALYSIS_DURATION_SECONDS),
  );
  const channelData =
    buffer.numberOfChannels > 1
      ? (() => {
          const merged = new Float32Array(maxSamples);
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const source = buffer.getChannelData(channel);
            for (let i = 0; i < maxSamples; i++) {
              merged[i] += source[i] ?? 0;
            }
          }
          for (let i = 0; i < maxSamples; i++) {
            merged[i] /= buffer.numberOfChannels;
          }
          return merged;
        })()
      : buffer.getChannelData(0).slice(0, maxSamples);

  const history = new Array<number>(ENERGY_HISTORY_SIZE).fill(0);
  let historyIndex = 0;
  let lastBeatTime = -Infinity;
  const beats: BeatMarker[] = [];
  const blockSize = 1024;

  for (let index = 0; index < maxSamples; index += blockSize) {
    let sum = 0;
    for (
      let offset = 0;
      offset < blockSize && index + offset < maxSamples;
      offset++
    ) {
      const sample = channelData[index + offset];
      sum += sample * sample;
    }
    const energy = sum / blockSize;
    const avgEnergy =
      history.reduce((acc, value) => acc + value, 0) / ENERGY_HISTORY_SIZE;
    const threshold = avgEnergy * ENERGY_SENSITIVITY;
    const beatTime = index / sampleRate;

    if (
      avgEnergy > 0 &&
      energy > threshold &&
      beatTime - lastBeatTime >= MIN_BEAT_INTERVAL
    ) {
      if (beats.length < MAX_BEATS_TRACKED) {
        beats.push({ time: beatTime, strength: energy });
      }
      lastBeatTime = beatTime;
    }

    history[historyIndex] = energy;
    historyIndex = (historyIndex + 1) % ENERGY_HISTORY_SIZE;
  }

  return {
    beats,
    bpm: deriveBpmFromBeats(beats),
  };
};

const analyzeBeatsFromUrl = async (url: string) => {
  const AudioContextClass = getAudioContextConstructor();
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser.");
  }
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Failed to load audio (${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContextClass();

  try {
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      audioContext.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
    });
    return extractBeatMarkers(audioBuffer);
  } finally {
    audioContext.close().catch(() => undefined);
  }
};

interface StandaloneEditorAppProps {
  autoHydrate?: boolean;
  projectId?: string | null;
}

export const StandaloneEditorApp = ({
  autoHydrate = true,
  projectId = null,
}: StandaloneEditorAppProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const thumbnailAttemptsRef = useRef<Set<string>>(new Set());
  const trackVolumeDebounceRef = useRef<Record<string, number>>({});
  const [timelineWidth, setTimelineWidth] = useState(1200);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    progress: number;
    status: string;
  } | null>(null);
  const [masterVolume, setMasterVolume] = useState(1);
  const [beatMarkers, setBeatMarkers] = useState<BeatMarker[]>([]);
  const [snapToBeats, setSnapToBeats] = useState(false);
  const [analysisMeta, setAnalysisMeta] = useState<{ bpm?: number } | null>(
    null,
  );
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzingBeatTrack, setIsAnalyzingBeatTrack] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<"media" | "transitions" | "filters" | "speed">("media");
  const [selectedTransition, setSelectedTransition] = useState<TransitionSpec | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<Effect | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteClips, setPendingDeleteClips] = useState<string[]>([]);
  const [timelineHeight, setTimelineHeight] = useState(340);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);

  // Convex hooks for project persistence
  const saveProject = useMutation(api.editor.saveProject);
  const saveHistorySnapshot = useMutation(api.editor.saveHistorySnapshot);
  const clearFutureHistory = useMutation(api.editor.clearFutureHistory);
  const loadProject = useQuery(api.editor.loadProject, {});
  const loadProjectHistory = useMutation(api.editor.loadProjectHistory);
  const updateAudioTrackSettings = useMutation(
    api.video.updateProjectAudioTrackSettings,
  );

  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);
  const selection = useProjectStore((state) => state.selection);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const currentTime = useProjectStore((state) => state.currentTime);
  const clipboard = useProjectStore((state) => state.clipboard);
  const actions = useProjectStore((state) => state.actions);

  // Wire up Convex to the store
  useEffect(() => {
    actions.setSaveProject(saveProject);
    actions.setSaveHistorySnapshot(saveHistorySnapshot);
    actions.setClearFutureHistory(clearFutureHistory);
    actions.setLoadProject(async (args) => {
      // Convex hooks return data directly, wrap in async function
      return loadProject || null;
    });
    actions.setLoadProjectHistory(loadProjectHistory);
  }, [
    actions,
    saveProject,
    saveHistorySnapshot,
    clearFutureHistory,
    loadProject,
    loadProjectHistory,
  ]);
  const mediaManager = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return getMediaBunnyManager();
    } catch (error) {
      return null;
    }
  }, []);
  const exportManager = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return getExportPipeline();
    } catch (error) {
      return null;
    }
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyboardShortcuts = (event: KeyboardEvent) => {
      // Skip if typing in input fields
      const active = document.activeElement;
      if (
        active &&
        (active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const { selection, actions: storeActions, project, clipboard, currentTime } = useProjectStore.getState();
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? event.metaKey : event.ctrlKey;

      // Delete/Backspace - Delete selected clips (ripple delete)
      // Cmd+Delete - Also ripple delete (explicit ripple delete shortcut)
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selection.clipIds.length) return;
        event.preventDefault();

        // Show confirmation for multiple clips
        if (selection.clipIds.length > 1) {
          setPendingDeleteClips(selection.clipIds);
          setDeleteDialogOpen(true);
        } else {
          // Single clip - delete immediately using multi-select rippleDelete
          storeActions.rippleDelete(selection.clipIds);
          storeActions.setSelection({ clipIds: [], trackIds: [] });
        }
        return;
      }

      // Cmd+D - Duplicate selected clips
      if (cmdKey && event.key === "d") {
        if (!selection.clipIds.length) return;
        event.preventDefault();
        selection.clipIds.forEach((clipId) => storeActions.duplicateClip(clipId));
        return;
      }

      // Cmd+B - Split clip at playhead
      if (cmdKey && event.key === "b") {
        if (!selection.clipIds.length || !project) return;
        event.preventDefault();

        const sequence = project.sequences.find((seq) => seq.id === project.settings.activeSequenceId);
        if (!sequence) return;

        let splitCount = 0;

        // Split each selected clip if playhead is over it
        selection.clipIds.forEach((clipId) => {
          const clip = sequence.tracks
            .flatMap((track) => track.clips)
            .find((c) => c.id === clipId);

          if (!clip) return;

          const clipEnd = clip.start + clip.duration;

          // Validate playhead is within clip bounds before splitting
          if (currentTime > clip.start && currentTime < clipEnd) {
            storeActions.splitClipAtTime(clipId, currentTime);
            splitCount++;
          }
        });

        // Optional: Log if no clips were split (for debugging)
        if (splitCount === 0 && selection.clipIds.length > 0) {
          console.warn('Split at playhead: Playhead is not positioned over any selected clips');
        }
        return;
      }

      // Cmd+C - Copy selected clips
      if (cmdKey && event.key === "c") {
        if (!selection.clipIds.length) return;
        event.preventDefault();
        storeActions.copyClipsToClipboard(selection.clipIds);
        return;
      }

      // Cmd+X - Cut selected clips
      if (cmdKey && event.key === "x") {
        if (!selection.clipIds.length) return;
        event.preventDefault();
        storeActions.cutClipsToClipboard(selection.clipIds);
        storeActions.setSelection({ clipIds: [], trackIds: [] });
        return;
      }

      // Cmd+V - Paste clips from clipboard
      if (cmdKey && event.key === "v") {
        if (!clipboard || !project) return;
        event.preventDefault();

        const sequence = project.sequences.find((seq) => seq.id === project.settings.activeSequenceId);
        if (!sequence) return;

        const videoTrack = sequence.tracks.find((t) => t.kind === "video");
        if (!videoTrack) return;

        storeActions.pasteClipsFromClipboard(videoTrack.id, currentTime);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  }, []);

  useEffect(() => {
    const handleKeySpace = (event: KeyboardEvent) => {
      if (event.key !== " ") {
        return;
      }
      const active = document.activeElement;
      if (
        active &&
        (active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active.getAttribute("contenteditable") === "true")
      ) {
        return;
      }
      event.preventDefault();
      actions.togglePlayback();
    };
    window.addEventListener("keydown", handleKeySpace);
    return () => window.removeEventListener("keydown", handleKeySpace);
  }, [actions]);

  useEffect(() => {
    if (autoHydrate) {
      actions.hydrate();
    }
  }, [actions, autoHydrate]);
  useEffect(() => {
    setBeatMarkers([]);
    setAnalysisMeta(null);
    setSnapToBeats(false);
    setAnalysisError(null);
  }, [projectId]);
  useEffect(() => {
    return () => {
      Object.values(trackVolumeDebounceRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  // Track timeline container width for responsive Konva canvas
  useEffect(() => {
    if (!timelineContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTimelineWidth(entry.contentRect.width);
      }
    });

    observer.observe(timelineContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || !project || !canvasRef.current) return;
    if (!rendererRef.current) {
      rendererRef.current = new PreviewRenderer(
        () => {
          const state = useProjectStore.getState();
          if (!state.project) return null;
          return (
            state.project.sequences.find(
              (sequence) =>
                sequence.id === state.project?.settings.activeSequenceId,
            ) ?? null
          );
        },
        (id) => useProjectStore.getState().project?.mediaAssets[id],
      );
      rendererRef.current
        .attach(canvasRef.current)
        .then(async () => {
          if (project?.mediaAssets) {
            await rendererRef.current?.preloadAudioAssets(project.mediaAssets);
          }
          rendererRef.current?.setMasterVolume(masterVolume);
          // PERFORMANCE FIX: Don't update store on every frame (60x/sec)
          // Canvas updates independently, only sync on user actions (seek/play/pause)
          // rendererRef.current?.setTimeUpdateHandler((time) => actions.setCurrentTime(time));
        })
        .catch((error) => {
          // Silently handle attach errors
        });
    }
  }, [ready, project, actions, masterVolume]);

  useEffect(() => {
    if (!project?.mediaAssets || !rendererRef.current) return;
    rendererRef.current
      .preloadAudioAssets(project.mediaAssets)
      .catch((error) => {
        console.error("Failed to preload audio assets", error);
      });
  }, [project?.mediaAssets]);

  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (isPlaying) {
      renderer.play().catch(() => {
        // Silently handle playback errors
      });
    } else {
      renderer.pause();
    }
  }, [isPlaying]);

  // REMOVED: This useEffect created a circular loop causing flickering
  // The renderer updates its own time during playback
  // We only need to seek when user manually seeks (handled in handleSeek callback)
  // useEffect(() => {
  //   rendererRef.current?.seek(currentTime);
  // }, [currentTime]);

  // Generate thumbnails for videos that don't have them yet
  useEffect(() => {
    if (!ready || !project || !mediaManager) return;

    const assetsNeedingThumbnails = Object.values(project.mediaAssets).filter(
      (asset) => {
        // Skip if already attempted
        if (thumbnailAttemptsRef.current.has(asset.id)) {
          return false;
        }
        return asset.type === "video" && asset.url && !asset.thumbnails;
      }
    );

    if (assetsNeedingThumbnails.length === 0) return;

    console.log(`[Editor] Generating thumbnails for ${assetsNeedingThumbnails.length} video asset(s)`);

    // Generate thumbnails for all video assets in parallel
    const thumbnailPromises = assetsNeedingThumbnails.map(async (asset) => {
      // Mark as attempted
      thumbnailAttemptsRef.current.add(asset.id);

      try {
        console.log(`[Editor] Starting thumbnail generation for asset ${asset.id}`);
        const thumbnails = await mediaManager.generateThumbnails(
          asset.id,
          asset.url,
          asset.duration,
          1 // Generate only first frame (CapCut style)
        );
        // Update asset with thumbnails
        actions.addMediaAsset({
          ...asset,
          thumbnails,
          thumbnailCount: thumbnails.length,
        });
        console.log(`[Editor] Successfully updated asset ${asset.id} with ${thumbnails.length} thumbnails`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Editor] Failed to generate thumbnails for ${asset.id}:`, {
          error: errorMessage,
          assetUrl: asset.url,
          assetType: asset.type,
        });

        // Mark asset with empty thumbnail array to prevent retry loop
        actions.addMediaAsset({
          ...asset,
          thumbnails: [],
          thumbnailCount: 0,
        });
      }
    });

    // Wait for all thumbnails to complete (optional, but good for debugging)
    Promise.all(thumbnailPromises)
      .then(() => console.log(`[Editor] All thumbnail generation complete`))
      .catch((err) => console.error(`[Editor] Thumbnail generation error:`, err));
  }, [ready, project, mediaManager, actions]);

  const handleImport = async (files: FileList | null) => {
    if (!files || !mediaManager) return;
    console.log(`[Editor] Importing ${files.length} file(s)`);
    const imports: Promise<MediaAssetMeta>[] = [];
    Array.from(files).forEach((file) => {
      imports.push(mediaManager.importFile(file));
    });
    const results = await Promise.all(imports);

    // Generate thumbnails for video assets
    const videoAssets = results.filter((asset) => asset.type === "video" && asset.url);
    if (videoAssets.length > 0) {
      console.log(`[Editor] Generating thumbnails for ${videoAssets.length} imported video(s)`);
      const thumbnailPromises = videoAssets.map(async (asset) => {
        // Mark as attempted
        thumbnailAttemptsRef.current.add(asset.id);

        try {
          console.log(`[Editor] Starting thumbnail generation for imported asset ${asset.id}`);
          const thumbnails = await mediaManager.generateThumbnails(
            asset.id,
            asset.url,
            asset.duration,
            1 // Generate only first frame (CapCut style)
          );
          // Update the asset with thumbnails
          actions.addMediaAsset({
            ...asset,
            thumbnails,
            thumbnailCount: thumbnails.length,
          });
          console.log(`[Editor] Successfully updated imported asset ${asset.id} with ${thumbnails.length} thumbnails`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Editor] Failed to generate thumbnails for imported asset ${asset.id}:`, {
            error: errorMessage,
            assetUrl: asset.url,
            assetType: asset.type,
          });

          // Mark asset with empty thumbnail array to prevent retry loop
          actions.addMediaAsset({
            ...asset,
            thumbnails: [],
            thumbnailCount: 0,
          });
        }
      });

      Promise.all(thumbnailPromises)
        .then(() => console.log(`[Editor] All import thumbnail generation complete`))
        .catch((err) => console.error(`[Editor] Import thumbnail generation error:`, err));
    }

    // Add all assets to the store
    results.forEach((asset) => {
      console.log(`[Editor] Added media asset: ${asset.id} (${asset.type})`);
      actions.addMediaAsset(asset);
    });
  };

  const handleExport = async (options: {
    resolution: string;
    quality: string;
    format: string;
  }) => {
    if (!project || !exportManager) {
      if (!exportManager) {
        alert("Export is unavailable in this environment.");
      }
      return;
    }
    const sequence =
      project.sequences.find(
        (seq) => seq.id === project.settings.activeSequenceId,
      ) ?? project.sequences[0];
    setExportStatus({ progress: 0, status: "Preparing" });
    try {
      const blob = await exportManager.exportSequence(
        sequence,
        project.mediaAssets,
        options,
        (progress, status) => {
          setExportStatus({ progress, status });
        },
      );
      await saveBlob(blob, `${project.title || "export"}.${options.format}`);
      setExportStatus({ progress: 100, status: "Complete" });
    } catch (error) {
      console.error("Export failed", error);
      setExportStatus(null);
      alert(`Export failed: ${error instanceof Error ? error.message : error}`);
    }
  };

  // Memoize callbacks to prevent child re-renders
  const handleTogglePlayback = useCallback(() => {
    actions.togglePlayback();
  }, [actions]);

  const handleSeek = useCallback(
    (time: number) => {
      actions.setCurrentTime(time);
    },
    [actions],
  );

  const handleUndo = useCallback(() => {
    actions.undo();
  }, [actions]);

  const handleRedo = useCallback(() => {
    actions.redo();
  }, [actions]);

  const handleOpenExport = useCallback(() => {
    setExportOpen(true);
  }, []);

  const assets = useMemo(
    () => (project ? Object.values(project.mediaAssets) : []),
    [project],
  );
  const sequence = project?.sequences.find(
    (seq) => seq.id === project.settings.activeSequenceId,
  );
  const zoom = project?.settings.zoom ?? 1;

  const narrationTrackRef = sequence?.tracks.find(
    (track) => track.id === NARRATION_TRACK_ID,
  );
  const fallbackAudioTrack = sequence?.tracks.find(
    (track) => track.kind === "audio",
  );
  const primaryAudioTrack = narrationTrackRef ?? fallbackAudioTrack ?? null;
  const audioTrackMuted = primaryAudioTrack?.muted ?? false;
  const audioTrackId = primaryAudioTrack?.id ?? null;
  const selectedClipId = selection.clipIds[0] ?? null;
  const selectedClip =
    selectedClipId && sequence
      ? sequence.tracks
          .flatMap((track) => track.clips)
          .find((clip) => clip.id === selectedClipId) ?? null
      : null;
  const selectedAudioClipId =
    selectedClip && selectedClip.kind === "audio" ? selectedClip.id : null;
  const selectedAudioClipVolume =
    selectedClip && selectedClip.kind === "audio"
      ? selectedClip.volume ?? 1
      : 1;
  const audioTracks =
    sequence?.tracks.filter((track) => track.kind === "audio") ?? [];
  const bgmTrack = sequence?.tracks.find((track) => track.id === BGM_TRACK_ID);
  const bgmAsset = useMemo(() => {
    if (!project || !bgmTrack) return null;
    const firstClip = bgmTrack.clips[0];
    if (!firstClip) return null;
    return project.mediaAssets[firstClip.mediaId] ?? null;
  }, [project, bgmTrack]);
  const persistTrackSettings = useCallback(
    (
      trackId: PersistableAudioTrackId,
      payload: { volume?: number; muted?: boolean },
    ) => {
      if (!projectId) return;
      void updateAudioTrackSettings({
        projectId: projectId as Id<"videoProjects">,
        trackId,
        ...payload,
      });
    },
    [projectId, updateAudioTrackSettings],
  );
  const analyzeBackgroundTrack = useCallback(async () => {
    if (!bgmAsset?.url) {
      setAnalysisError("No background music track available to analyze.");
      return;
    }
    setIsAnalyzingBeatTrack(true);
    setAnalysisError(null);
    try {
      console.log("[Editor] Starting beat analysis", {
        assetId: bgmAsset.id,
        url: bgmAsset.url,
      });
      const analysis = await analyzeBeatsFromUrl(bgmAsset.url);
      setBeatMarkers(analysis.beats);
      setAnalysisMeta(
        typeof analysis.bpm === "number" ? { bpm: analysis.bpm } : null,
      );
      if (analysis.beats.length === 0) {
        setAnalysisError("No clear beats detected in this track.");
      } else {
        setAnalysisError(null);
        if (!snapToBeats) {
          setSnapToBeats(true);
        }
      }
      console.log("[Editor] Beat analysis complete", {
        beatCount: analysis.beats.length,
        bpm: analysis.bpm,
      });
    } catch (error) {
      console.error("[Editor] Beat analysis error", {
        error,
        assetId: bgmAsset.id,
        url: bgmAsset.url,
      });
      setAnalysisError(
        error instanceof Error ? error.message : "Unable to analyze audio.",
      );
    } finally {
      setIsAnalyzingBeatTrack(false);
    }
  }, [bgmAsset, snapToBeats]);

  const handleMasterVolumeChange = useCallback((value: number) => {
    const nextVolume = Math.max(0, Math.min(1, value));
    setMasterVolume(nextVolume);
    rendererRef.current?.setMasterVolume(nextVolume);
  }, []);

  const handleToggleAudioTrackMute = useCallback(() => {
    if (!audioTrackId || !sequence) return;
    const currentTrack = sequence.tracks.find(
      (track) => track.id === audioTrackId,
    );
    const nextMuted = !(currentTrack?.muted ?? false);
    actions.toggleTrackMute(audioTrackId);
    if (isPersistableAudioTrack(audioTrackId)) {
      persistTrackSettings(audioTrackId, { muted: nextMuted });
    }
  }, [actions, audioTrackId, persistTrackSettings, sequence]);

  const handleAudioClipVolumeChange = useCallback(
    (value: number) => {
      if (!selectedAudioClipId) return;
      actions.setClipVolume(
        selectedAudioClipId,
        Math.max(0, Math.min(1, value)),
      );
    },
    [actions, selectedAudioClipId],
  );

  const handleTrackVolumeChange = useCallback(
    (trackId: string, value: number) => {
      const clamped = Math.max(0, Math.min(1, value));
      actions.setTrackVolume(trackId, clamped);
      if (!projectId || !isPersistableAudioTrack(trackId)) {
        return;
      }
      const timers = trackVolumeDebounceRef.current;
      if (timers[trackId]) {
        window.clearTimeout(timers[trackId]);
      }
      timers[trackId] = window.setTimeout(() => {
        persistTrackSettings(trackId, { volume: clamped });
        delete timers[trackId];
      }, 250);
    },
    [actions, persistTrackSettings, projectId],
  );

  const handleSelectTransition = useCallback((transition: TransitionSpec) => {
    setSelectedTransition(transition);
    console.log("[Editor] Transition selected:", transition);

    // If a clip is selected, apply the transition to it
    if (selectedClipId) {
      actions.addTransitionToClip(selectedClipId, transition);
      console.log("[Editor] Applied transition to clip:", selectedClipId);
    }
  }, [selectedClipId, actions]);

  const handleSelectFilter = useCallback((effect: Effect) => {
    setSelectedFilter(effect);
    console.log("[Editor] Filter selected:", effect);

    // If a clip is selected, apply the effect to it
    if (selectedClipId) {
      actions.addEffectToClip(selectedClipId, effect);
      console.log("[Editor] Applied filter to clip:", selectedClipId);
    }
  }, [selectedClipId, actions]);

  const handleSpeedCurveChange = useCallback((speedCurve: import("@/lib/editor/types").SpeedCurve | null) => {
    console.log("[Editor] Speed curve changed:", speedCurve);

    // If a clip is selected, update its speed curve
    if (selectedClipId) {
      actions.setClipSpeedCurve(selectedClipId, speedCurve);
      console.log("[Editor] Applied speed curve to clip:", selectedClipId);
    }
  }, [selectedClipId, actions]);

  // Context menu handlers
  const handleContextMenuCut = useCallback(() => {
    if (!selection.clipIds.length) return;
    actions.cutClipsToClipboard(selection.clipIds);
    actions.setSelection({ clipIds: [], trackIds: [] });
  }, [selection.clipIds, actions]);

  const handleContextMenuCopy = useCallback(() => {
    if (!selection.clipIds.length) return;
    actions.copyClipsToClipboard(selection.clipIds);
  }, [selection.clipIds, actions]);

  const handleContextMenuPaste = useCallback(() => {
    if (!clipboard || !sequence) return;
    const videoTrack = sequence.tracks.find((t) => t.kind === "video");
    if (!videoTrack) return;
    actions.pasteClipsFromClipboard(videoTrack.id, currentTime);
  }, [clipboard, sequence, currentTime, actions]);

  const handleContextMenuDuplicate = useCallback(() => {
    if (!selection.clipIds.length) return;
    selection.clipIds.forEach((clipId) => actions.duplicateClip(clipId));
  }, [selection.clipIds, actions]);

  // TODO: Split-at-playhead needs refinement - should work more intuitively like Premiere/CapCut
  // Current behavior: Only splits if playhead is positioned over the selected clip
  // Desired behavior: Could split at playhead regardless, or add "Split Here" for click position
  const handleContextMenuSplit = useCallback(() => {
    if (!selection.clipIds.length || !sequence) return;

    let splitCount = 0;

    // Split each selected clip if playhead is over it
    selection.clipIds.forEach((clipId) => {
      const clip = sequence.tracks
        .flatMap((track) => track.clips)
        .find((c) => c.id === clipId);

      if (!clip) return;

      const clipEnd = clip.start + clip.duration;

      // Validate playhead is within clip bounds before splitting
      if (currentTime > clip.start && currentTime < clipEnd) {
        actions.splitClipAtTime(clipId, currentTime);
        splitCount++;
      }
    });

    // Optional: Log if no clips were split (for debugging)
    if (splitCount === 0 && selection.clipIds.length > 0) {
      console.warn('Split at playhead: Playhead is not positioned over any selected clips');
    }
  }, [selection.clipIds, sequence, currentTime, actions]);

  const handleContextMenuDelete = useCallback(() => {
    if (!selection.clipIds.length) return;

    // Show confirmation for multiple clips
    if (selection.clipIds.length > 1) {
      setPendingDeleteClips(selection.clipIds);
      setDeleteDialogOpen(true);
    } else {
      // Single clip - delete immediately using multi-select rippleDelete
      actions.rippleDelete(selection.clipIds);
      actions.setSelection({ clipIds: [], trackIds: [] });
    }
  }, [selection.clipIds, actions]);

  const handleConfirmDelete = useCallback(() => {
    // Use multi-select rippleDelete for efficient gap closure
    actions.rippleDelete(pendingDeleteClips);
    actions.setSelection({ clipIds: [], trackIds: [] });
    setPendingDeleteClips([]);
  }, [pendingDeleteClips, actions]);

  // Canvas resize handler
  const handleCanvasResize = useCallback((width: number, height: number) => {
    if (rendererRef.current) {
      rendererRef.current.resize(width, height);
    }
  }, []);

  // Timeline resize handlers
  const handleTimelineResizeStart = useCallback(() => {
    setIsResizingTimeline(true);
  }, []);

  const handleTimelineResize = useCallback((e: MouseEvent) => {
    if (!isResizingTimeline) return;

    // Calculate new height from bottom of window
    const windowHeight = window.innerHeight;
    const newHeight = windowHeight - e.clientY;

    // Clamp between min (200px) and max (60% of window height)
    const minHeight = 200;
    const maxHeight = windowHeight * 0.6;
    const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    setTimelineHeight(clampedHeight);
  }, [isResizingTimeline]);

  const handleTimelineResizeEnd = useCallback(() => {
    setIsResizingTimeline(false);
  }, []);

  // Add mouse event listeners for timeline resize
  useEffect(() => {
    if (!isResizingTimeline) return;

    window.addEventListener('mousemove', handleTimelineResize);
    window.addEventListener('mouseup', handleTimelineResizeEnd);

    return () => {
      window.removeEventListener('mousemove', handleTimelineResize);
      window.removeEventListener('mouseup', handleTimelineResizeEnd);
    };
  }, [isResizingTimeline, handleTimelineResize, handleTimelineResizeEnd]);

  if (!ready || !project || !sequence) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading editor…
      </div>
    );
  }


  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar
        title={project.title}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={sequence.duration}
        onTogglePlayback={handleTogglePlayback}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleOpenExport}
        masterVolume={masterVolume}
        onMasterVolumeChange={handleMasterVolumeChange}
        audioTrackMuted={audioTrackMuted}
        onToggleAudioTrack={handleToggleAudioTrackMute}
        selectedAudioClipVolume={
          selectedAudioClipId ? selectedAudioClipVolume : undefined
        }
        onAudioClipVolumeChange={
          selectedAudioClipId ? handleAudioClipVolumeChange : undefined
        }
      />
      {audioTracks.length > 0 && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Audio Mixer</p>
              <p className="text-xs text-muted-foreground">
                Adjust overall levels for each audio layer
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {audioTracks.map((track) => {
                const label = TRACK_LABELS[track.id] || track.id;
                const volume = track.volume ?? 1;
                const isBgmTrack = track.id === BGM_TRACK_ID;
                return (
                  <Card key={track.id} className="p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{label}</span>
                      <span>{Math.round(volume * 100)}%</span>
                    </div>
                    <Slider
                      value={[volume]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={([value]) =>
                        handleTrackVolumeChange(
                          track.id,
                          value ?? volume,
                        )
                      }
                    />
                    {isBgmTrack && (
                      <>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={analyzeBackgroundTrack}
                            disabled={
                              !bgmAsset?.url || isAnalyzingBeatTrack
                            }
                          >
                            {isAnalyzingBeatTrack ? (
                              <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                Analyzing…
                              </>
                            ) : (
                              <>
                                <Waves className="mr-2 h-3.5 w-3.5" />
                                Analyze Audio
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant={snapToBeats ? "default" : "outline"}
                            onClick={() => setSnapToBeats((prev) => !prev)}
                            disabled={!beatMarkers.length}
                          >
                            {snapToBeats ? "Snap On" : "Snap to Beat"}
                          </Button>
                          {analysisMeta?.bpm && (
                            <span className="text-xs text-muted-foreground">
                              BPM: {Math.round(analysisMeta.bpm)}
                            </span>
                          )}
                        </div>
                        {analysisError && (
                          <p className="mt-2 text-xs text-destructive">
                            {analysisError}
                          </p>
                        )}
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* 2-row layout: Top row (media/transitions + preview) and bottom row (timeline) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top row: Left Panel (1/3) + Preview (2/3) */}
        <div className="grid grid-cols-[1fr_2fr] flex-1 overflow-hidden min-h-0">
          {/* Left Panel: Tabbed Media + Transitions */}
          <Tabs value={leftPanelTab} onValueChange={(v) => setLeftPanelTab(v as typeof leftPanelTab)} className="flex flex-col h-full">
            <div className="border-r border-border bg-muted/20 px-2 pt-2">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="media" className="gap-1.5">
                  <span>Media</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
                    {assets.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="transitions" className="gap-1.5">
                  <span>Transitions</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
                    {TRANSITION_PRESETS.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="filters" className="gap-1.5">
                  <span>Filters</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
                    {FILTER_PRESETS.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="speed">Speed</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="media" className="flex-1 mt-0 overflow-auto">
              <MediaPanel
                assets={assets}
                onImport={handleImport}
                onAddToTimeline={(assetId) => actions.appendClipFromAsset(assetId)}
              />
            </TabsContent>
            <TabsContent value="transitions" className="flex-1 mt-0 overflow-auto">
              <TransitionLibrary
                onSelectTransition={handleSelectTransition}
                selectedPresetId={selectedTransition?.id}
              />
            </TabsContent>
            <TabsContent value="filters" className="flex-1 mt-0 overflow-auto">
              <FilterLibrary
                onSelectFilter={handleSelectFilter}
                selectedPresetId={selectedFilter?.id}
              />
            </TabsContent>
            <TabsContent value="speed" className="flex-1 mt-0 overflow-auto">
              {selectedClip ? (
                <SpeedControlPanel
                  speedCurve={selectedClip.speedCurve}
                  clipDuration={selectedClip.duration}
                  currentTime={Math.max(0, currentTime - selectedClip.start)}
                  onSpeedCurveChange={handleSpeedCurveChange}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
                  Select a clip to adjust its playback speed
                </div>
              )}
            </TabsContent>
          </Tabs>
          <PreviewPanel
            canvasRef={canvasRef}
            currentTime={currentTime}
            duration={sequence.duration}
            isPlaying={isPlaying}
            onTogglePlayback={handleTogglePlayback}
            onSeek={handleSeek}
            onCanvasResize={handleCanvasResize}
            timelineHeight={timelineHeight}
          />
        </div>
        {/* Resize handle */}
        <div
          className="flex-none h-1 bg-border hover:bg-primary cursor-ns-resize transition-colors group relative"
          onMouseDown={handleTimelineResizeStart}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-1 bg-muted-foreground/30 rounded-full group-hover:bg-primary/50 transition-colors" />
          </div>
        </div>
        {/* Bottom row: Timeline (full width) */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className="flex-none flex flex-col"
              style={{ height: `${timelineHeight}px` }}
              ref={timelineContainerRef}
            >
              <KonvaTimeline
                sequence={sequence}
                selectedClipId={selection.clipIds[0] || null}
                selectedClipIds={selection.clipIds}
                currentTime={currentTime}
                isPlaying={isPlaying}
                containerWidth={timelineWidth}
                containerHeight={timelineHeight}
                assets={assets}
                onClipSelect={(clipId) =>
                  actions.setSelection({ clipIds: [clipId], trackIds: [] })
                }
                onClipMultiSelect={(clipIds) =>
                  actions.setSelection({ clipIds, trackIds: [] })
                }
                onClipMove={(clipId, newStart) => {
                  const videoTrack = sequence.tracks.find(
                    (t) => t.kind === "video",
                  );
                  if (videoTrack) {
                    actions.moveClip(clipId, videoTrack.id, newStart);
                  }
                }}
                onClipReorder={(clips) => actions.reorderClips(clips)}
                onClipTrim={(clipId, trimStart, trimEnd) =>
                  actions.trimClip(clipId, trimStart, trimEnd)
                }
                onSeek={handleSeek}
                onScrub={(time) => rendererRef.current?.seek(time)}
                onScrubStart={() => {
                  if (
                    rendererRef.current &&
                    typeof rendererRef.current.startScrubbing === "function"
                  ) {
                    rendererRef.current.startScrubbing();
                  }
                }}
                onScrubEnd={() => {
                  if (
                    rendererRef.current &&
                    typeof rendererRef.current.endScrubbing === "function"
                  ) {
                    rendererRef.current.endScrubbing();
                  }
                }}
                beatMarkers={beatMarkers}
                snapToBeats={snapToBeats}
              />
            </div>
          </ContextMenuTrigger>
          {selectedClipId && (
            <ClipContextMenu
              clipId={selectedClipId}
              selectedClipIds={selection.clipIds}
              playheadTime={currentTime}
              clipStart={selectedClip?.start || 0}
              clipEnd={(selectedClip?.start || 0) + (selectedClip?.duration || 0)}
              hasClipboard={!!clipboard}
              onCut={handleContextMenuCut}
              onCopy={handleContextMenuCopy}
              onPaste={handleContextMenuPaste}
              onDuplicate={handleContextMenuDuplicate}
              onSplit={handleContextMenuSplit}
              onDelete={handleContextMenuDelete}
            />
          )}
        </ContextMenu>
      </div>
      <ExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        duration={sequence.duration}
        onExport={handleExport}
        status={exportStatus}
      />
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        clipCount={pendingDeleteClips.length}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default StandaloneEditorApp;
