"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "@/components/editor/TopBar";
import { MediaPanel } from "@/components/editor/MediaPanel";
import { PreviewPanel } from "@/components/editor/PreviewPanel";
import { TransitionLibrary } from "@/components/editor/TransitionLibrary";
import { FilterLibrary } from "@/components/editor/FilterLibrary";
import { ExportModal } from "@/components/ExportModal";
import { KonvaTimeline } from "@/components/editor/KonvaTimeline";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { useSnapManager } from "@/lib/editor/hooks/useSnapManager";
import { getMediaBunnyManager } from "@/lib/editor/io/media-bunny-manager";
import { playbackUrlForAsset } from "@/lib/editor/io/asset-url";
import { PreviewRenderer } from "@/lib/editor/playback/preview-renderer";
import { getExportPipeline } from "@/lib/editor/export/export-pipeline";
import { saveBlob } from "@/lib/editor/export/save-file";
import type { MediaAssetMeta } from "@/lib/editor/types";

interface LegacyEditorAppProps {
  autoHydrate?: boolean;
  projectId?: string | null;
  onSwitchToModern: () => void;
}

export const LegacyEditorApp = ({
  autoHydrate = true,
  projectId = null,
  onSwitchToModern,
}: LegacyEditorAppProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const thumbnailInflight = useRef<Set<string>>(new Set());
  const thumbnailsCompletedRef = useRef<Set<string>>(new Set());
  const [timelineWidth, setTimelineWidth] = useState(1200);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ progress: number; status: string } | null>(
    null,
  );
  const [masterVolume, setMasterVolume] = useState(1);

  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);
  const selection = useProjectStore((state) => state.selection);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const currentTime = useProjectStore((state) => state.currentTime);
  const rippleEditEnabled = useProjectStore((state) => state.rippleEditEnabled);
  const actions = useProjectStore((state) => state.actions);
  
  // Get beat markers and snap settings from audio analysis
  const { beatMarkers, snapEnabled } = useSnapManager();

  const mediaManager = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return getMediaBunnyManager();
    } catch {
      return null;
    }
  }, []);

  const exportManager = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return getExportPipeline();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (autoHydrate) {
      actions.hydrate(projectId ?? undefined);
    }
  }, [actions, autoHydrate, projectId]);

  // Renderer setup (WebGL/2D only for legacy)
  useEffect(() => {
    if (!ready || !project || !canvasRef.current) return;
    if (!rendererRef.current) {
      const getSequence = () => {
        const state = useProjectStore.getState();
        if (!state.project) return null;
        return (
          state.project.sequences.find(
            (sequence) => sequence.id === state.project?.settings.activeSequenceId,
          ) ?? null
        );
      };
      const getAsset = (id: string) => useProjectStore.getState().project?.mediaAssets[id];
      rendererRef.current = new PreviewRenderer(getSequence, getAsset);
      rendererRef.current
        .attach(canvasRef.current)
        .then(() => rendererRef.current?.setMasterVolume(masterVolume))
        .catch(() => undefined);
    }
  }, [ready, project, masterVolume, actions]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (isPlaying) {
      renderer.play().catch(() => undefined);
    } else {
      renderer.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    rendererRef.current?.seek(currentTime);
  }, [currentTime]);

  useEffect(() => {
    return () => {
      rendererRef.current?.pause();
      rendererRef.current = null;
    };
  }, []);

  // Resize observer for timeline width
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!timelineContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setTimelineWidth(entry.contentRect.width);
    });
    observer.observe(timelineContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleImport = async (files: FileList | null) => {
    if (!files || !mediaManager) return;
    const imports: Promise<MediaAssetMeta>[] = [];
    Array.from(files).forEach((file) => imports.push(mediaManager.importFile(file)));
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
      project.sequences.find((seq) => seq.id === project.settings.activeSequenceId) ??
      project.sequences[0];
    setExportStatus({ progress: 0, status: "Preparing" });
    try {
      const blob = await exportManager.exportProject(
        project,
        sequence,
        { ...options, aspectRatio: "16:9" }, // Legacy editor defaults to 16:9
        (progress, status) => setExportStatus({ progress, status }),
      );
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
  
  // Calculate audio track and clip counts for export modal
  const audioStats = useMemo(() => {
    if (!sequence) return { trackCount: 0, clipCount: 0 };
    const audioTracks = sequence.tracks.filter(track => track.kind === 'audio');
    const audioClipCount = audioTracks.reduce((total, track) => total + track.clips.length, 0);
    return {
      trackCount: audioTracks.length,
      clipCount: audioClipCount
    };
  }, [sequence]);
  
  // Memoize video asset IDs that need thumbnails to prevent excessive re-renders
  const videoAssetIdsNeedingThumbnails = useMemo(() => {
    if (!project) return [];
    return Object.values(project.mediaAssets)
      .filter(asset =>
        asset.type === 'video' &&
        (!asset.thumbnails || asset.thumbnails.length === 0)
      )
      .map(asset => asset.id);
  }, [project?.mediaAssets]);

  // Legacy thumbnail generation (first-frame)
  useEffect(() => {
    if (!ready || !project || !mediaManager) return;
    
    // Only process assets that need thumbnails and haven't been completed yet
    videoAssetIdsNeedingThumbnails.forEach((assetId) => {
      // Skip if already completed (persists across renders)
      if (thumbnailsCompletedRef.current.has(assetId)) return;
      // Skip if currently processing
      if (thumbnailInflight.current.has(assetId)) return;
      
      const asset = project.mediaAssets[assetId];
      if (!asset) return;
      
      const url = playbackUrlForAsset(asset);
      if (!url) return;
      
      thumbnailInflight.current.add(assetId);
      void mediaManager
        .generateThumbnails(assetId, url, asset.duration, 1)
        .then((thumbs) => {
          actions.updateMediaAsset(assetId, {
            thumbnails: thumbs ?? [],
            thumbnailCount: thumbs?.length ?? 0,
          });
          // Mark as completed to prevent re-generation on future renders
          thumbnailsCompletedRef.current.add(assetId);
        })
        .catch(() => undefined)
        .finally(() => thumbnailInflight.current.delete(assetId));
    });
  }, [ready, videoAssetIdsNeedingThumbnails, mediaManager, project, actions]);

  if (!ready || !project || !sequence) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading editor…
      </div>
    );
  }

  const selectedClipId = selection.clipIds[0] ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0f0c13] text-foreground">
      <TopBar
        title={project.title}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={sequence.duration}
        onTogglePlayback={() => actions.togglePlayback()}
        onUndo={() => actions.undo()}
        onRedo={() => actions.redo()}
        onExport={() => setExportOpen(true)}
        timelineMode="legacy"
        onToggleTimelineMode={onSwitchToModern}
        masterVolume={masterVolume}
        onMasterVolumeChange={(value) => {
          setMasterVolume(value);
          rendererRef.current?.setMasterVolume(value);
        }}
        audioTrackMuted={false}
        onToggleAudioTrack={() => undefined}
        rippleEditEnabled={rippleEditEnabled}
        onToggleRippleEdit={() => actions.toggleRippleEdit()}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="grid grid-cols-[320px_1fr_320px] flex-1 overflow-hidden border-b border-border bg-[#120f1a]">
          <div className="border-r border-border bg-[#1a1525]">
            <div className="border-b border-border px-3 py-2 text-xs font-semibold text-red-200 uppercase tracking-wide">
              Library
            </div>
            <div className="flex-1 overflow-hidden">
              <MediaPanel
                assets={assets}
                onImport={handleImport}
                onAddToTimeline={(assetId) => actions.appendClipFromAsset(assetId)}
              />
            </div>
            <div className="border-t border-border">
              <TransitionLibrary onSelectTransition={() => undefined} selectedPresetId={undefined} />
              <FilterLibrary onSelectFilter={() => undefined} selectedPresetId={undefined} />
            </div>
          </div>

          <div className="relative flex flex-col bg-black">
            <PreviewPanel
              canvasRef={canvasRef}
              currentTime={currentTime}
              duration={sequence.duration}
              isPlaying={isPlaying}
              onTogglePlayback={() => actions.togglePlayback()}
              onSeek={(time) => actions.setCurrentTime(time)}
            />
          </div>

          <div className="border-l border-border bg-[#1a1525]">
            <div className="border-b border-border px-3 py-2 text-xs font-semibold text-red-200 uppercase tracking-wide">
              Properties
            </div>
            <div className="p-4 text-sm text-muted-foreground">
              {selectedClipId ? (
                <div>
                  <div className="font-semibold text-red-200 mb-1">Clip ID</div>
                  <div className="break-all text-xs">{selectedClipId}</div>
                  <div className="mt-3 text-xs text-red-200">Adjustments coming soon.</div>
                </div>
              ) : (
                <div className="text-xs opacity-60">Select a clip to edit properties.</div>
              )}
            </div>
          </div>
        </div>

        <div className="h-[360px] bg-[#0f0c13] border-t border-border flex flex-col" ref={timelineContainerRef}>
          <KonvaTimeline
            sequence={sequence}
            selectedClipId={selectedClipId}
            selectedClipIds={selection.clipIds}
            currentTime={currentTime}
            isPlaying={isPlaying}
            containerWidth={timelineWidth}
            containerHeight={360}
            assets={assets}
            onClipSelect={(clipId) => actions.setSelection({ clipIds: [clipId], trackIds: [] })}
            onClipMove={(clipId, newStart) => {
              const track = sequence.tracks.find((t) => t.clips.some((c) => c.id === clipId));
              if (track) actions.moveClip(clipId, track.id, newStart);
            }}
            onClipReorder={(clips) => {
              const next = structuredClone(project);
              const seq =
                next.sequences.find((seq) => seq.id === next.settings.activeSequenceId) ??
                next.sequences[0];
              if (seq) {
                seq.tracks.forEach((track) => {
                  track.clips = track.clips
                    .map((clip) => clips.find((c) => c.id === clip.id) ?? clip)
                    .sort((a, b) => a.start - b.start);
                });
                void actions.loadProject(next, { persist: true });
              }
            }}
            onClipTrim={(clipId, trimStart, trimEnd) => actions.trimClip(clipId, trimStart, trimEnd)}
            onSeek={(time) => actions.setCurrentTime(time)}
            onScrub={(time) => rendererRef.current?.seek(time)}
            onScrubStart={() => rendererRef.current?.pause()}
            onScrubEnd={() => undefined}
            beatMarkers={beatMarkers}
            snapToBeats={snapEnabled}
            magneticSnapEnabled
            magneticSnapThreshold={0.1}
          />
        </div>
      </div>

      <ExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        duration={sequence.duration}
        onExport={handleExport}
        status={exportStatus}
        audioTrackCount={audioStats.trackCount}
        audioClipCount={audioStats.clipCount}
      />
    </div>
  );
};

export default LegacyEditorApp;

