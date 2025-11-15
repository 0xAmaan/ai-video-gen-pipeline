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
import { Timeline } from "@/components/editor/Timeline";
import { ExportModal } from "@/components/ExportModal";
import type { MediaAssetMeta } from "@/lib/editor/types";

interface StandaloneEditorAppProps {
  autoHydrate?: boolean;
}

export const StandaloneEditorApp = ({ autoHydrate = true }: StandaloneEditorAppProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
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

  const handleImport = async (files: FileList | null) => {
    if (!files || !mediaManager) return;
    const imports: Promise<MediaAssetMeta>[] = [];
    Array.from(files).forEach((file) => {
      imports.push(mediaManager.importFile(file));
    });
    const results = await Promise.all(imports);
    results.forEach((asset) => actions.addMediaAsset(asset));
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
    <div className="flex h-screen flex-col">
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
      <div className="flex flex-1 overflow-hidden">
        <MediaPanel
          assets={assets}
          onImport={handleImport}
          onAddToTimeline={(assetId) => actions.appendClipFromAsset(assetId)}
        />
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="flex-none">
            <PreviewPanel
              canvasRef={canvasRef}
              currentTime={currentTime}
              duration={sequence.duration}
              isPlaying={isPlaying}
              onTogglePlayback={() => actions.togglePlayback()}
              onSeek={(time) => actions.setCurrentTime(time)}
            />
          </div>
          <div className="flex-1 min-h-[280px]">
            <Timeline
              sequence={sequence}
              selection={selection}
              zoom={zoom}
              snap={project.settings.snap}
              currentTime={currentTime}
              onSelectionChange={(clipId) => actions.setSelection({ clipIds: [clipId], trackIds: [] })}
              onMoveClip={(clipId, trackId, start) => actions.moveClip(clipId, trackId, start)}
              onTrimClip={(clipId, trimStart, trimEnd) => actions.trimClip(clipId, trimStart, trimEnd)}
              onSeek={(time) => actions.setCurrentTime(time)}
              onZoomChange={(value) => actions.setZoom(value)}
            />
          </div>
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
