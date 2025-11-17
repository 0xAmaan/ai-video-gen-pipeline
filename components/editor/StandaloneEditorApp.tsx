"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import { ExportModal } from "@/components/ExportModal";
import { ConfirmDeleteDialog } from "@/components/editor/ConfirmDeleteDialog";
import { ClipContextMenu } from "@/components/editor/ClipContextMenu";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MediaAssetMeta, TransitionSpec } from "@/lib/editor/types";

interface StandaloneEditorAppProps {
  autoHydrate?: boolean;
}

export const StandaloneEditorApp = ({
  autoHydrate = true,
}: StandaloneEditorAppProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const thumbnailAttemptsRef = useRef<Set<string>>(new Set());
  const [timelineWidth, setTimelineWidth] = useState(1200);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    progress: number;
    status: string;
  } | null>(null);
  const [masterVolume, setMasterVolume] = useState(1);
  const [leftPanelTab, setLeftPanelTab] = useState<"media" | "transitions">("media");
  const [selectedTransition, setSelectedTransition] = useState<TransitionSpec | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteClips, setPendingDeleteClips] = useState<string[]>([]);

  // Convex hooks for project persistence
  const saveProject = useMutation(api.editor.saveProject);
  const saveHistorySnapshot = useMutation(api.editor.saveHistorySnapshot);
  const clearFutureHistory = useMutation(api.editor.clearFutureHistory);
  const loadProject = useQuery(api.editor.loadProject, {});
  const loadProjectHistory = useMutation(api.editor.loadProjectHistory);

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

      const { selection, actions: storeActions, project, clipboard } = useProjectStore.getState();
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? event.metaKey : event.ctrlKey;

      // Delete/Backspace - Delete selected clips
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selection.clipIds.length) return;
        event.preventDefault();

        // Show confirmation for multiple clips
        if (selection.clipIds.length > 1) {
          setPendingDeleteClips(selection.clipIds);
          setDeleteDialogOpen(true);
        } else {
          // Single clip - delete immediately
          selection.clipIds.forEach((clipId) => storeActions.rippleDelete(clipId));
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

        const currentTime = storeActions.currentTime ?? 0;

        // Split each selected clip if playhead is over it
        selection.clipIds.forEach((clipId) => {
          const clip = sequence.tracks
            .flatMap((track) => track.clips)
            .find((c) => c.id === clipId);

          if (clip && currentTime > clip.start && currentTime < clip.start + clip.duration) {
            storeActions.splitClipAtTime(clipId, currentTime);
          }
        });
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

        const currentTime = storeActions.currentTime ?? 0;
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

  const audioTrack = sequence?.tracks.find((track) => track.kind === "audio");
  const audioTrackMuted = audioTrack?.muted ?? false;
  const audioTrackId = audioTrack?.id ?? null;
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

  const handleMasterVolumeChange = useCallback((value: number) => {
    const nextVolume = Math.max(0, Math.min(1, value));
    setMasterVolume(nextVolume);
    rendererRef.current?.setMasterVolume(nextVolume);
  }, []);

  const handleToggleAudioTrackMute = useCallback(() => {
    if (audioTrackId) {
      actions.toggleTrackMute(audioTrackId);
    }
  }, [actions, audioTrackId]);

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

  const handleSelectTransition = useCallback((transition: TransitionSpec) => {
    setSelectedTransition(transition);
    console.log("[Editor] Transition selected:", transition);

    // If a clip is selected, apply the transition to it
    if (selectedClipId) {
      actions.addTransitionToClip(selectedClipId, transition);
      console.log("[Editor] Applied transition to clip:", selectedClipId);
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

  const handleContextMenuSplit = useCallback(() => {
    if (!selection.clipIds.length || !sequence) return;

    // Split each selected clip if playhead is over it
    selection.clipIds.forEach((clipId) => {
      const clip = sequence.tracks
        .flatMap((track) => track.clips)
        .find((c) => c.id === clipId);

      if (clip && currentTime > clip.start && currentTime < clip.start + clip.duration) {
        actions.splitClipAtTime(clipId, currentTime);
      }
    });
  }, [selection.clipIds, sequence, currentTime, actions]);

  const handleContextMenuDelete = useCallback(() => {
    if (!selection.clipIds.length) return;

    // Show confirmation for multiple clips
    if (selection.clipIds.length > 1) {
      setPendingDeleteClips(selection.clipIds);
      setDeleteDialogOpen(true);
    } else {
      // Single clip - delete immediately
      selection.clipIds.forEach((clipId) => actions.rippleDelete(clipId));
      actions.setSelection({ clipIds: [], trackIds: [] });
    }
  }, [selection.clipIds, actions]);

  const handleConfirmDelete = useCallback(() => {
    pendingDeleteClips.forEach((clipId) => actions.rippleDelete(clipId));
    actions.setSelection({ clipIds: [], trackIds: [] });
    setPendingDeleteClips([]);
  }, [pendingDeleteClips, actions]);

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
      {/* 2-row layout: Top row (media/transitions + preview) and bottom row (timeline) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top row: Left Panel (1/3) + Preview (2/3) */}
        <div className="grid grid-cols-[1fr_2fr] flex-1 overflow-hidden">
          {/* Left Panel: Tabbed Media + Transitions */}
          <Tabs value={leftPanelTab} onValueChange={(v) => setLeftPanelTab(v as typeof leftPanelTab)} className="flex flex-col h-full">
            <div className="border-r border-border bg-muted/20 px-2 pt-2">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="transitions">Transitions</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="media" className="flex-1 mt-0 overflow-hidden">
              <MediaPanel
                assets={assets}
                onImport={handleImport}
                onAddToTimeline={(assetId) => actions.appendClipFromAsset(assetId)}
              />
            </TabsContent>
            <TabsContent value="transitions" className="flex-1 mt-0 overflow-hidden">
              <TransitionLibrary
                onSelectTransition={handleSelectTransition}
                selectedPresetId={selectedTransition?.id}
              />
            </TabsContent>
          </Tabs>
          <PreviewPanel
            canvasRef={canvasRef}
            currentTime={currentTime}
            duration={sequence.duration}
            isPlaying={isPlaying}
            onTogglePlayback={handleTogglePlayback}
            onSeek={handleSeek}
          />
        </div>
        {/* Bottom row: Timeline (full width) */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className="flex-none h-[340px] flex flex-col"
              ref={timelineContainerRef}
            >
              <KonvaTimeline
                sequence={sequence}
                selectedClipId={selection.clipIds[0] || null}
                currentTime={currentTime}
                isPlaying={isPlaying}
                containerWidth={timelineWidth}
                containerHeight={340}
                assets={assets}
                onClipSelect={(clipId) =>
                  actions.setSelection({ clipIds: [clipId], trackIds: [] })
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
