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
import { ExportModal } from "@/components/ExportModal";
import type { MediaAssetMeta } from "@/lib/editor/types";

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

  // Convex hooks for project persistence
  const saveProject = useMutation(api.editor.saveProject);
  const loadProject = useQuery(api.editor.loadProject, {});

  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);
  const selection = useProjectStore((state) => state.selection);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const currentTime = useProjectStore((state) => state.currentTime);
  const actions = useProjectStore((state) => state.actions);

  // Wire up Convex to the store
  useEffect(() => {
    actions.setSaveProject(saveProject);
    actions.setLoadProject(async (args) => {
      // Convex hooks return data directly, wrap in async function
      return loadProject || null;
    });
  }, [actions, saveProject, loadProject]);
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

  useEffect(() => {
    const handleKeyDelete = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
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
      const { selection, actions: storeActions } = useProjectStore.getState();
      if (!selection.clipIds.length) {
        return;
      }
      event.preventDefault();
      selection.clipIds.forEach((clipId) => storeActions.rippleDelete(clipId));
      storeActions.setSelection({ clipIds: [], trackIds: [] });
    };
    window.addEventListener("keydown", handleKeyDelete);
    return () => window.removeEventListener("keydown", handleKeyDelete);
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
        .then(() => {
          // PERFORMANCE FIX: Don't update store on every frame (60x/sec)
          // Canvas updates independently, only sync on user actions (seek/play/pause)
          // rendererRef.current?.setTimeUpdateHandler((time) => actions.setCurrentTime(time));
        })
        .catch((error) => {
          // Silently handle attach errors
        });
    }
  }, [ready, project, actions]);

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
        actions.updateMediaAsset(asset.id, {
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
        actions.updateMediaAsset(asset.id, {
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
          actions.updateMediaAsset(asset.id, {
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
          actions.updateMediaAsset(asset.id, {
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
      />
      {/* 2-row layout: Top row (media + preview) and bottom row (timeline) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top row: Media (1/3) + Preview (2/3) */}
        <div className="grid grid-cols-[1fr_2fr] flex-1 overflow-hidden">
          <MediaPanel
            assets={assets}
            onImport={handleImport}
            onAddToTimeline={(assetId) => actions.appendClipFromAsset(assetId)}
          />
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
      </div>
      <ExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        duration={sequence.duration}
        onExport={handleExport}
        status={exportStatus}
      />
    </div>
  );
};

export default StandaloneEditorApp;
