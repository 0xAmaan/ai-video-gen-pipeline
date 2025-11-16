"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export const StandaloneEditorApp = ({ autoHydrate = true }: StandaloneEditorAppProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const [timelineWidth, setTimelineWidth] = useState(1200);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ progress: number; status: string } | null>(null);
  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);
  const selection = useProjectStore((state) => state.selection);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const currentTime = useProjectStore((state) => state.currentTime);
  const actions = useProjectStore((state) => state.actions);
  const mediaManager = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return getMediaBunnyManager();
    } catch (error) {
      console.warn("Media imports disabled:", error);
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
      console.warn("Export disabled:", error);
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
              (sequence) => sequence.id === state.project?.settings.activeSequenceId,
            ) ?? null
          );
        },
        (id) => useProjectStore.getState().project?.mediaAssets[id],
      );
      rendererRef.current
        .attach(canvasRef.current)
        .then(() => rendererRef.current?.setTimeUpdateHandler((time) => actions.setCurrentTime(time)))
        .catch((error) => console.warn("preview attach failed", error));
    }
  }, [ready, project, actions]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (isPlaying) {
      renderer.play().catch((error) => console.warn("playback failed", error));
    } else {
      renderer.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    rendererRef.current?.seek(currentTime);
  }, [currentTime]);

  // Generate thumbnails for videos that don't have them yet
  useEffect(() => {
    if (!ready || !project || !mediaManager) return;

    const generateMissingThumbnails = async () => {
      const assets = Object.values(project.mediaAssets);

      for (const asset of assets) {
        // Skip if not a video or already has thumbnails
        if (asset.type !== "video" || asset.thumbnails?.length) continue;

        try {
          console.log(`Generating thumbnails for ${asset.name}...`);
          const thumbnails = await mediaManager.generateThumbnails(
            asset.id,
            asset.url,
            asset.duration,
            15
          );

          // Update the asset in the store
          const updatedAsset = { ...asset, thumbnails, thumbnailCount: thumbnails.length };
          actions.addMediaAsset(updatedAsset);
          console.log(`Generated ${thumbnails.length} thumbnails for ${asset.name}`);
        } catch (error) {
          console.warn(`Thumbnail generation failed for ${asset.name}:`, error);
        }
      }
    };

    generateMissingThumbnails();
  }, [ready, project, mediaManager, actions]);

  const handleImport = async (files: FileList | null) => {
    if (!files || !mediaManager) return;
    const imports: Promise<MediaAssetMeta>[] = [];
    Array.from(files).forEach((file) => {
      imports.push(mediaManager.importFile(file));
    });
    const results = await Promise.all(imports);

    // Generate thumbnails for video assets
    for (const asset of results) {
      if (asset.type === "video") {
        try {
          console.log(`Generating thumbnails for ${asset.name}...`);
          const thumbnails = await mediaManager.generateThumbnails(
            asset.id,
            asset.url,
            asset.duration,
            15 // 15 thumbnails per video
          );
          asset.thumbnails = thumbnails;
          asset.thumbnailCount = thumbnails.length;
          console.log(`Generated ${thumbnails.length} thumbnails for ${asset.name}`);
        } catch (error) {
          console.warn(`Thumbnail generation failed for ${asset.name}:`, error);
        }
      }
      actions.addMediaAsset(asset);
    }
  };

  const handleExport = async (options: { resolution: string; quality: string; format: string }) => {
    if (!project || !exportManager) {
      if (!exportManager) {
        alert("Export is unavailable in this environment.");
      }
      return;
    }
    const sequence =
      project.sequences.find((seq) => seq.id === project.settings.activeSequenceId) ?? project.sequences[0];
    setExportStatus({ progress: 0, status: "Preparing" });
    try {
      const blob = await exportManager.exportSequence(sequence, options, (progress, status) => {
        setExportStatus({ progress, status });
      });
      await saveBlob(blob, `${project.title || "export"}.${options.format}`);
      setExportStatus({ progress: 100, status: "Complete" });
    } catch (error) {
      console.error("Export failed", error);
      setExportStatus(null);
      alert(`Export failed: ${error instanceof Error ? error.message : error}`);
    }
  };

  const assets = useMemo(() => (project ? Object.values(project.mediaAssets) : []), [project]);
  const sequence = project?.sequences.find((seq) => seq.id === project.settings.activeSequenceId);
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
        onTogglePlayback={() => actions.togglePlayback()}
        onUndo={() => actions.undo()}
        onRedo={() => actions.redo()}
        onExport={() => setExportOpen(true)}
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
            onTogglePlayback={() => actions.togglePlayback()}
            onSeek={(time) => actions.setCurrentTime(time)}
          />
        </div>
        {/* Bottom row: Timeline (full width) */}
        <div className="flex-none h-[340px] flex flex-col" ref={timelineContainerRef}>
          <KonvaTimeline
            sequence={sequence}
            selectedClipId={selection.clipIds[0] || null}
            currentTime={currentTime}
            isPlaying={isPlaying}
            containerWidth={timelineWidth}
            containerHeight={340}
            assets={assets}
            onClipSelect={(clipId) => actions.setSelection({ clipIds: [clipId], trackIds: [] })}
            onClipMove={(clipId, newStart) => {
              const videoTrack = sequence.tracks.find((t) => t.kind === "video");
              if (videoTrack) {
                actions.moveClip(clipId, videoTrack.id, newStart);
              }
            }}
            onClipReorder={(clips) => actions.reorderClips(clips)}
            onClipTrim={(clipId, trimStart, trimEnd) => actions.trimClip(clipId, trimStart, trimEnd)}
            onSeek={(time) => actions.setCurrentTime(time)}
            onScrub={(time) => rendererRef.current?.seek(time)}
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
