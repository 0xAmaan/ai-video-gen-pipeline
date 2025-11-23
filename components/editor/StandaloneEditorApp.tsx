"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { getMediaBunnyManager } from "@/lib/editor/io/media-bunny-manager";
import { playbackUrlForAsset } from "@/lib/editor/io/asset-url";
import { PreviewRenderer } from "@/lib/editor/playback/preview-renderer";
import { WebGpuPreviewRenderer } from "@/lib/editor/playback/webgpu-preview-renderer";
import { getExportPipeline } from "@/lib/editor/export/export-pipeline";
import { saveBlob } from "@/lib/editor/export/save-file";
import { TopBar } from "@/components/editor/TopBar";
import { MediaPanel } from "@/components/editor/MediaPanel";
import { PreviewPanel } from "@/components/editor/PreviewPanel";
import { ExportModal } from "@/components/ExportModal";
import type { MediaAssetMeta } from "@/lib/editor/types";
import { EditorController } from "@/components/editor/EditorController";
import LegacyEditorApp from "@/components/editor/LegacyEditorApp";
import { AutoSpliceDialog } from "@/components/editor/AutoSpliceDialog";
import { autoSpliceOnBeats, getClipBeatAnalysisStatus } from "@/lib/editor/utils/auto-splice";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useEditorProjectSync } from "@/lib/editor/hooks/useEditorProjectSync";
import { useConvexAuth } from "convex/react";

interface StandaloneEditorAppProps {
  autoHydrate?: boolean;
  projectId?: string;
}

export const StandaloneEditorApp = ({ autoHydrate = true, projectId: propsProjectId }: StandaloneEditorAppProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | WebGpuPreviewRenderer | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ progress: number; status: string } | null>(null);
  const [masterVolume, setMasterVolume] = useState(1);
  const [audioTrackMuted, setAudioTrackMuted] = useState(false);
  const [timelineMode, setTimelineMode] = useState<"twick" | "legacy">("twick");
  const [autoSpliceDialogOpen, setAutoSpliceDialogOpen] = useState(false);
  const [autoSpliceClipId, setAutoSpliceClipId] = useState<string | null>(null);
  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);
  const selection = useProjectStore((state) => state.selection);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const currentTime = useProjectStore((state) => state.currentTime);
  const rippleEditEnabled = useProjectStore((state) => state.rippleEditEnabled);
  const multiTrackRipple = useProjectStore((state) => state.multiTrackRipple);
  const actions = useProjectStore((state) => state.actions);
  const thumbnailInflight = useRef<Set<string>>(new Set());
  const thumbnailsCompletedRef = useRef<Set<string>>(new Set());
  const webGpuFailed = useRef(false);

  // Automatically sync local project to Convex and get Convex project ID
  const { isAuthenticated } = useConvexAuth();
  const convexProjectId = useEditorProjectSync(project, isAuthenticated);

  // Convex mutations for asset management
  const createConvexAsset = useMutation(api.editorAssets.createAsset);

  // STABILITY FIX: Use WebGL in legacy mode; allow Twick mode to use WebGPU when available.
  const forceWebGL = timelineMode === "legacy";

  const swapToFallbackRenderer = () => {
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
    if (canvasRef.current) {
      void rendererRef.current
        .attach(canvasRef.current)
        .then(() => rendererRef.current?.setTimeUpdateHandler((time) => actions.setCurrentTime(time)))
        .catch((error) => console.warn("preview fallback attach failed", error));
    }
  };
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
      actions.hydrate(project?.id ?? propsProjectId);
    }
  }, [actions, autoHydrate, project?.id, propsProjectId]);

  useEffect(() => {
    // When switching modes, reset the renderer so it re-initializes with the chosen backend.
    if (rendererRef.current) {
      rendererRef.current.pause();
      if ("detach" in rendererRef.current && typeof (rendererRef.current as any).detach === "function") {
        try {
          (rendererRef.current as any).detach();
        } catch {
          /* ignore detach errors */
        }
      }
      rendererRef.current = null;
    }
  }, [timelineMode]);

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
      const preferWebGPU =
        !forceWebGL &&
        timelineMode === "twick" &&
        typeof navigator !== "undefined" &&
        !webGpuFailed.current &&
        Boolean((navigator as any).gpu);

      if (preferWebGPU) {
        try {
          rendererRef.current = new WebGpuPreviewRenderer(getSequence, getAsset);
        } catch (error) {
          console.warn("[WebGPU] Renderer creation failed, falling back to WebGL", {
            error,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
          });
          webGpuFailed.current = true;
          rendererRef.current = new PreviewRenderer(getSequence, getAsset);
        }
      } else {
        rendererRef.current = new PreviewRenderer(getSequence, getAsset);
      }
      rendererRef.current
        .attach(canvasRef.current)
        .then(() => rendererRef.current?.setTimeUpdateHandler((time) => actions.setCurrentTime(time)))
        .catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Enhanced error logging with context
          console.error("[Renderer] Attach failed:", {
            error: errorMessage,
            rendererType: rendererRef.current instanceof WebGpuPreviewRenderer ? "WebGPU" : "WebGL",
            canvasSize: canvasRef.current ? {
              width: canvasRef.current.width,
              height: canvasRef.current.height,
            } : null,
          });

          // Mark WebGPU as failed if that was the issue
          if (rendererRef.current instanceof WebGpuPreviewRenderer) {
            console.warn("[WebGPU] Adapter attach failed, marking WebGPU as unavailable and falling back");
            webGpuFailed.current = true;
          }

          swapToFallbackRenderer();
        });
    }
  }, [ready, project, actions, timelineMode]);

  useEffect(() => {
    const renderer = rendererRef.current;
    console.log('[StandaloneEditorApp] isPlaying changed:', isPlaying, 'renderer exists:', !!renderer);
    if (!renderer) {
      console.warn('[StandaloneEditorApp] Cannot play/pause - renderer not initialized');
      return;
    }
    if (isPlaying) {
      console.log('[StandaloneEditorApp] Calling renderer.play()');
      renderer
        .play()
        .catch((error) => {
          console.error('[StandaloneEditorApp] Playback failed:', error);
          swapToFallbackRenderer();
        });
    } else {
      console.log('[StandaloneEditorApp] Calling renderer.pause()');
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
    
    // Add assets to local state
    results.forEach((asset) => actions.addMediaAsset(asset));
    
    // Optionally sync to Convex if authenticated and have project ID
    if (isAuthenticated && convexProjectId) {
      // Create Convex asset records in parallel
      try {
        const syncResults = await Promise.allSettled(
          results.map(async (asset) => {
            const convexAssetId = await createConvexAsset({
              projectId: convexProjectId,
              type: asset.type,
              name: asset.name,
              url: asset.url,
              duration: asset.duration,
              r2Key: asset.r2Key,
              proxyUrl: asset.proxyUrl,
              width: asset.width,
              height: asset.height,
              fps: asset.fps,
              thumbnails: asset.thumbnails,
              waveform: asset.waveform ? Array.from(asset.waveform) : undefined,
              sampleRate: asset.sampleRate,
            });
            
            // Update local asset with Convex ID (keep local id intact)
            actions.updateMediaAsset(asset.id, {
              convexAssetId: convexAssetId
            });
            
            return { success: true, assetName: asset.name };
          })
        );
        
        // Check for failures
        const failures = syncResults.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
          console.error('Some assets failed to sync:', failures);
          toast.error(`Failed to sync ${failures.length} asset(s) to cloud`);
        } else if (results.length > 1) {
          toast.success(`${results.length} assets synced to cloud`);
        }
      } catch (err) {
        const error = err as Error;
        if (error.message?.includes('Not authenticated')) {
          toast.info('Assets saved locally. Sign in to sync to cloud.');
        } else {
          console.error('Asset sync error:', err);
          toast.error('Failed to sync assets to cloud');
        }
      }
    } else if (!isAuthenticated && results.length > 0) {
      toast.info('Assets saved locally. Sign in to enable cloud sync.');
    }
  };

  const handleExport = async (options: { resolution: string; quality: string; format: string; aspectRatio: string }) => {
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
      const blob = await exportManager.exportProject(
        project,
        sequence,
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

  const assets = useMemo(() => (project ? Object.values(project.mediaAssets) : []), [project]);
  
  // Memoize video asset IDs that need thumbnails to prevent excessive re-renders
  const videoAssetIdsNeedingThumbnails = useMemo(() => {
    if (!project) return [];
    return Object.values(project.mediaAssets)
      .filter(asset =>
        asset.type === 'video' &&
        (!asset.thumbnails || asset.thumbnails.length === 0)
      )
      .map(asset => asset.id);
  }, [project]);
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

  useEffect(() => {
    if (!mediaManager || !project) return;
    
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
        // Reduced from 12 to 6 thumbnails to prevent Convex document size limit
        // TODO: Move thumbnails to R2 storage for proper solution
        .generateThumbnails(assetId, url, asset.duration, 6)
        .then((thumbs) => {
          if (!thumbs?.length) return;
          actions.updateMediaAsset(assetId, {
            thumbnails: thumbs,
            thumbnailCount: thumbs.length,
          });
          // Mark as completed to prevent re-generation on future renders
          thumbnailsCompletedRef.current.add(assetId);
        })
        .catch((error) => console.warn("thumbnail generation failed", assetId, error))
        .finally(() => {
          thumbnailInflight.current.delete(assetId);
        });
    });
  }, [videoAssetIdsNeedingThumbnails, mediaManager, project, actions]);

  if (!ready || !project || !sequence) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading editor…
      </div>
    );
  }

  if (timelineMode === "legacy") {
    return (
      <LegacyEditorApp
        autoHydrate={autoHydrate}
        projectId={propsProjectId}
        onSwitchToModern={() => setTimelineMode("twick")}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      <TopBar
        title={project.title}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={sequence.duration}
        onTogglePlayback={() => actions.togglePlayback()}
        onUndo={() => actions.undo()}
        onRedo={() => actions.redo()}
        onExport={() => setExportOpen(true)}
        timelineMode={timelineMode}
        onToggleTimelineMode={() =>
          setTimelineMode((prev) => (prev === "twick" ? "legacy" : "twick"))
        }
        masterVolume={masterVolume}
        onMasterVolumeChange={(value) => setMasterVolume(value)}
        audioTrackMuted={audioTrackMuted}
        onToggleAudioTrack={() => setAudioTrackMuted((prev) => !prev)}
        rippleEditEnabled={rippleEditEnabled}
        onToggleRippleEdit={() => actions.toggleRippleEdit()}
        multiTrackRipple={multiTrackRipple}
        onToggleMultiTrackRipple={() => actions.toggleMultiTrackRipple()}
      />
      
      <div className="flex flex-1 flex-col min-h-0">
        {/* Top Section: Media, Preview, Properties */}
        <div className="flex flex-1 min-h-0 border-b border-border">
          
          {/* Left: Media Panel */}
          <div className="w-[320px] flex-none border-r border-border flex flex-col bg-card/30">
            <MediaPanel
              assets={assets}
              onImport={handleImport}
              onAddToTimeline={(assetId) => actions.appendClipFromAsset(assetId)}
            />
          </div>

          {/* Center: Preview Panel */}
          <div className="flex-1 flex flex-col bg-black overflow-hidden">
              <PreviewPanel
                canvasRef={canvasRef}
                currentTime={currentTime}
                duration={sequence.duration}
                isPlaying={isPlaying}
                onTogglePlayback={() => actions.togglePlayback()}
                onSeek={(time) => actions.setCurrentTime(time)}
              />
          </div>

          {/* Right: Properties Panel (Placeholder) */}
          <div className="w-[320px] flex-none border-l border-border bg-card/30 flex flex-col">
             <div className="p-4 border-b border-border">
                <h3 className="font-medium text-sm">Properties</h3>
             </div>
             <div className="p-4 text-sm text-muted-foreground flex-1">
                {selection.clipIds.length > 0 ? (
                  <div>
                    <div className="mb-2">Selected: {selection.clipIds.length} clip(s)</div>
                    {/* Beat Analysis Auto-Splice */}
                    {selection.clipIds.length === 1 && (() => {
                      const clipId = selection.clipIds[0];
                      const beatStatus = project ? getClipBeatAnalysisStatus(project, clipId) : null;
                      if (beatStatus?.hasBeats) {
                        return (
                          <div className="mb-4 p-3 rounded-md border bg-card">
                            <div className="flex items-center gap-2 mb-2">
                              <Activity className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-sm">Beat Analysis</span>
                            </div>
                            <div className="text-xs text-muted-foreground mb-3">
                              {beatStatus.beatCount} beats detected
                              {beatStatus.bpm && ` • ${Math.round(beatStatus.bpm)} BPM`}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                setAutoSpliceClipId(clipId);
                                setAutoSpliceDialogOpen(true);
                              }}
                            >
                              <Activity className="mr-2 h-4 w-4" />
                              Auto-Splice on Beats...
                            </Button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* TODO: Add property editors here */}
                    <div className="text-xs opacity-50">Transform, Speed, Audio settings will appear here.</div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center opacity-50">
                    Select a clip to edit properties
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Bottom Section: Timeline */}
        <div className="h-[400px] flex-none flex flex-col bg-background border-t border-border">
          <EditorController />
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

      <AutoSpliceDialog
        open={autoSpliceDialogOpen}
        onOpenChange={setAutoSpliceDialogOpen}
        project={project}
        clipId={autoSpliceClipId ?? ""}
        onConfirm={(options) => {
          if (!project || !autoSpliceClipId) return;
          
          const result = autoSpliceOnBeats(project, autoSpliceClipId, options);
          
          if (result.success && result.project) {
            actions.loadProject(result.project);
            toast.success(`Spliced clip into ${result.cutCount + 1} clips at beat markers`);
          } else {
            toast.error(result.error ?? "Failed to splice clip");
          }
        }}
      />
    </div>
  );
};

export default StandaloneEditorApp;
