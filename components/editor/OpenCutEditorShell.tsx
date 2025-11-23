"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { TopBar } from "@/components/editor/TopBar";
import { MediaPanel } from "@/components/editor/MediaPanel";
import { VoiceGenerationPanel } from "@/components/editor/VoiceGenerationPanel";
import { PreviewPanel } from "@/components/editor/PreviewPanel";
import { EditorController } from "@/components/editor/EditorController";
import { ExportModal } from "@/components/ExportModal";
import { AutoSpliceDialog } from "@/components/editor/AutoSpliceDialog";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { getMediaBunnyManager } from "@/lib/editor/io/media-bunny-manager";
import { playbackUrlForAsset } from "@/lib/editor/io/asset-url";
import { PreviewRenderer } from "@/lib/editor/playback/preview-renderer";
import { WebGpuPreviewRenderer } from "@/lib/editor/playback/webgpu-preview-renderer";
import { getExportPipeline } from "@/lib/editor/export/export-pipeline";
import { saveBlob } from "@/lib/editor/export/save-file";
import { useEditorProjectSync } from "@/lib/editor/hooks/useEditorProjectSync";
import { getThumbnailCache } from "@/lib/editor/playback/thumbnail-cache";
import { autoSpliceOnBeats, getClipBeatAnalysisStatus } from "@/lib/editor/utils/auto-splice";
import type { MediaAssetMeta } from "@/lib/editor/types";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { LivePlayer } from "@twick/live-player";
import { projectToTimelineJSON } from "@/lib/editor/twick-adapter";

export interface OpenCutEditorShellProps {
  projectId?: string;
}

export const OpenCutEditorShell = ({ projectId }: OpenCutEditorShellProps) => {
  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);

  if (!ready || !project) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading CapCut experience…
      </div>
    );
  }

  return <OpenCutEditorContent projectId={projectId} />;
};

const OpenCutEditorContent = ({ projectId: propsProjectId }: OpenCutEditorShellProps) => {
  const project = useProjectStore((state) => state.project)!;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | WebGpuPreviewRenderer | null>(null);
  const rendererKindRef = useRef<"webgpu" | "canvas" | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<"media" | "voice">("media");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ progress: number; status: string } | null>(null);
  const [masterVolume, setMasterVolume] = useState(1);
  const [audioTrackMuted, setAudioTrackMuted] = useState(false);
  const [autoSpliceDialogOpen, setAutoSpliceDialogOpen] = useState(false);
  const [autoSpliceClipId, setAutoSpliceClipId] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState<"modern" | "legacy">("modern");
  const sequence = useMemo(() => {
    const activeId = project.settings.activeSequenceId;
    return project.sequences.find((seq) => seq.id === activeId) ?? project.sequences[0] ?? null;
  }, [project]);
  const twickPlayerProject = useMemo(() => projectToTimelineJSON(project), [project]);
  const selection = useProjectStore((state) => state.selection);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const currentTime = useProjectStore((state) => state.currentTime);
  const rippleEditEnabled = useProjectStore((state) => state.rippleEditEnabled);
  const multiTrackRipple = useProjectStore((state) => state.multiTrackRipple);
  const actions = useProjectStore((state) => state.actions);
  const [timelineMode, setTimelineMode] = useState<"twick" | "legacy">("twick");
  const thumbnailInflight = useRef<Set<string>>(new Set());
  const thumbnailsCompletedRef = useRef<Set<string>>(new Set());
  const webGpuFailed = useRef(false);
  const prevAnalysisStatusRef = useRef<string | undefined>(undefined);
  const { isAuthenticated } = useConvexAuth();
  const convexProjectId = useEditorProjectSync(project, isAuthenticated);
  const createConvexAsset = useMutation(api.editorAssets.createAsset);
  const analyzeBeatMutation = useMutation(api.editorAssets.analyzeBeat);

  const selectedClipAssetId = useMemo(() => {
    if (selection.clipIds.length !== 1 || !project) return null;
    const clipId = selection.clipIds[0];
    for (const seq of project.sequences) {
      for (const track of seq.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          const asset = project.mediaAssets[clip.mediaId];
          return asset?.convexAssetId ?? null;
        }
      }
    }
    return null;
  }, [selection.clipIds, project]);

  const beatAnalysisStatus = useQuery(
    api.editorAssets.getAssetAnalysisStatus,
    selectedClipAssetId ? { assetId: selectedClipAssetId } : "skip",
  );

  useEffect(() => {
    if (!beatAnalysisStatus) {
      prevAnalysisStatusRef.current = undefined;
      return;
    }
    const currentStatus = beatAnalysisStatus.status;
    const prevStatus = prevAnalysisStatusRef.current;
    if (prevStatus && prevStatus !== currentStatus) {
      if (currentStatus === "completed") {
        const beatCount = beatAnalysisStatus.beatCount;
        const bpm = beatAnalysisStatus.bpm;
        toast.success(
          `Beat analysis complete! ${beatCount} beat${beatCount !== 1 ? "s" : ""} detected` +
            (bpm ? ` at ${Math.round(bpm)} BPM` : ""),
        );
      } else if (currentStatus === "failed") {
        const errorMsg = beatAnalysisStatus.error || "Unknown error";
        toast.error(`Beat analysis failed: ${errorMsg}`);
      }
    }
    prevAnalysisStatusRef.current = currentStatus;
  }, [beatAnalysisStatus]);

  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const latestTimeRef = useRef(currentTime);
  useEffect(() => {
    latestTimeRef.current = currentTime;
  }, [currentTime]);

  const latestVolumeRef = useRef(masterVolume);
  useEffect(() => {
    latestVolumeRef.current = masterVolume;
  }, [masterVolume]);

  const mediaManager = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return getMediaBunnyManager();
    } catch (error) {
      console.warn("Media imports disabled:", error);
      return null;
    }
  }, []);

  const exportManager = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return getExportPipeline();
    } catch (error) {
      console.warn("Export disabled:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (timelineMode !== "legacy") {
      if (rendererRef.current) {
        try {
          rendererRef.current.detach?.();
        } catch (error) {
          console.warn("[Renderer] detach failed", error);
        }
        rendererRef.current = null;
        rendererKindRef.current = null;
      }
      return;
    }

    if (!canvasRef.current) return;

    const preferWebGPU =
      typeof navigator !== "undefined" &&
      !webGpuFailed.current &&
      Boolean((navigator as any).gpu);

    const desiredKind: "webgpu" | "canvas" = preferWebGPU ? "webgpu" : "canvas";

    const getSequence = () => {
      const state = useProjectStore.getState();
      const activeId = state.project?.settings.activeSequenceId;
      return state.project?.sequences.find((s) => s.id === activeId) ?? null;
    };
    const getAsset = (id: string) => useProjectStore.getState().project?.mediaAssets[id];

    const attachRenderer = async () => {
      if (rendererRef.current && rendererKindRef.current !== desiredKind) {
        try {
          rendererRef.current.detach?.();
        } catch (error) {
          console.warn("[Renderer] detach failed", error);
        }
        rendererRef.current = null;
        rendererKindRef.current = null;
      }

      if (!rendererRef.current) {
        if (desiredKind === "webgpu") {
          try {
            rendererRef.current = new WebGpuPreviewRenderer(getSequence, getAsset);
            rendererKindRef.current = "webgpu";
          } catch (error) {
            console.warn("[WebGPU] creation failed, falling back", error);
            webGpuFailed.current = true;
            rendererRef.current = new PreviewRenderer(getSequence, getAsset);
            rendererKindRef.current = "canvas";
          }
        }

        if (!rendererRef.current) {
          rendererRef.current = new PreviewRenderer(getSequence, getAsset);
          rendererKindRef.current = "canvas";
        }

        try {
          await rendererRef.current.attach(canvasRef.current!);
          rendererRef.current.setTimeUpdateHandler?.((time: number) => actionsRef.current.setCurrentTime(time));
          await rendererRef.current.seek?.(latestTimeRef.current ?? 0);
          if ("setMasterVolume" in rendererRef.current && typeof rendererRef.current.setMasterVolume === "function") {
            rendererRef.current.setMasterVolume(latestVolumeRef.current ?? 1);
          }
        } catch (error) {
          console.error("[Renderer] attach failed", error);
          webGpuFailed.current = true;
          rendererRef.current = null;
          rendererKindRef.current = null;
        }
      }
    };

    void attachRenderer();

    return () => {
      if (rendererRef.current) {
        try {
          rendererRef.current.detach?.();
        } catch (error) {
          console.warn("[Renderer] cleanup detach failed", error);
        }
        rendererRef.current = null;
        rendererKindRef.current = null;
      }
    };
  }, [timelineMode]);

  useEffect(() => {
    if (timelineMode !== "legacy" || !rendererRef.current) return;
    if (isPlaying) {
      rendererRef.current
        .play()
        .catch((error) => {
          console.error("[Renderer] play failed", error);
        });
    } else {
      rendererRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (timelineMode !== "legacy" || !rendererRef.current) return;
    if (isPlaying) {
      rendererRef.current
        .play()
        .catch((error) => {
          console.error("[Renderer] play failed", error);
        });
    } else {
      rendererRef.current.pause();
    }
  }, [timelineMode]);

  useEffect(() => {
    if (timelineMode !== "legacy") return;
    rendererRef.current?.seek?.(currentTime);
  }, [currentTime]);

  useEffect(() => {
    if (timelineMode !== "legacy") return;
    rendererRef.current?.seek?.(currentTime);
  }, [timelineMode]);

  useEffect(() => {
    if (!rendererRef.current) return;
    if ("setMasterVolume" in rendererRef.current && typeof rendererRef.current.setMasterVolume === "function") {
      rendererRef.current.setMasterVolume(masterVolume);
    }
  }, [masterVolume]);

  const handleImport = async (files: FileList | null) => {
    if (!files || !mediaManager) return;
    const imports: Promise<MediaAssetMeta>[] = [];
    Array.from(files).forEach((file) => {
      imports.push(mediaManager.importFile(file));
    });
    const results = await Promise.all(imports);
    results.forEach((asset) => actions.addMediaAsset(asset));

    const thumbnailCache = getThumbnailCache();
    results.forEach(async (asset) => {
      if (asset.type !== "video") return;
      const cached = await thumbnailCache.get(asset.id);
      if (cached?.length) {
        actions.updateMediaAsset(asset.id, { thumbnails: cached, thumbnailCount: cached.length });
        thumbnailsCompletedRef.current.add(asset.id);
        return;
      }
      thumbnailInflight.current.add(asset.id);
      const url = playbackUrlForAsset(asset);
      if (!url) {
        thumbnailInflight.current.delete(asset.id);
        return;
      }
      void mediaManager
        .generateThumbnails(asset.id, url, asset.duration, 6, (partial) => {
          if (partial.length) {
            actions.updateMediaAsset(asset.id, {
              thumbnails: partial,
              thumbnailCount: partial.length,
            });
          }
        })
        .then(async (thumbs) => {
          if (!thumbs?.length) return;
          await thumbnailCache.put(asset.id, thumbs);
          actions.updateMediaAsset(asset.id, { thumbnails: thumbs, thumbnailCount: thumbs.length });
          thumbnailsCompletedRef.current.add(asset.id);
        })
        .catch((error) => console.warn("thumbnail generation failed", asset.id, error))
        .finally(() => {
          thumbnailInflight.current.delete(asset.id);
        });
    });

    if (isAuthenticated && convexProjectId) {
      try {
        const syncResults = await Promise.allSettled(
          results.map(async (asset) => {
            const convexAssetId = await createConvexAsset({
              projectId: convexProjectId,
              type: asset.type,
              name: asset.name,
              url: asset.url,
              duration: asset.duration,
              // pragma: allowlist secret
              r2Key: asset.r2Key,
              proxyUrl: asset.proxyUrl,
              width: asset.width,
              height: asset.height,
              fps: asset.fps,
              thumbnails: asset.thumbnails,
              waveform: asset.waveform ? Array.from(asset.waveform) : undefined,
              sampleRate: asset.sampleRate,
            });
            actions.updateMediaAsset(asset.id, { convexAssetId });
          }),
        );
        const failures = syncResults.filter((r) => r.status === "rejected");
        if (failures.length) {
          toast.error(`Failed to sync ${failures.length} asset(s) to cloud`);
        } else if (results.length > 1) {
          toast.success(`${results.length} assets synced to cloud`);
        }
      } catch (err) {
        const error = err as Error;
        if (error.message?.includes("Not authenticated")) {
          toast.info("Assets saved locally. Sign in to sync to cloud.");
        } else {
          toast.error("Failed to sync assets to cloud");
        }
      }
    } else if (!isAuthenticated && results.length) {
      toast.info("Assets saved locally. Sign in to enable cloud sync.");
    }
  };

  const handleExport = async (options: { resolution: string; quality: string; format: string; aspectRatio: string }) => {
    if (!project || !exportManager) {
      if (!exportManager) alert("Export unavailable in this environment.");
      return;
    }
    const activeSequence = sequence ?? project.sequences[0];
    setExportStatus({ progress: 0, status: "Preparing" });
    try {
      const blob = await exportManager.exportProject(project, activeSequence, options, (progress, status) => {
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

  const videoAssetIdsNeedingThumbnails = useMemo(() => {
    if (!project) return [];
    return Object.values(project.mediaAssets)
      .filter((asset) => asset.type === "video" && (!asset.thumbnails || !asset.thumbnails.length))
      .map((asset) => asset.id);
  }, [project]);

  const audioStats = useMemo(() => {
    if (!sequence) {
      return { trackCount: 0, clipCount: 0 };
    }
    const audioTracks = sequence.tracks.filter((track) => track.kind === "audio");
    const clipCount = audioTracks.reduce((total, track) => total + track.clips.length, 0);
    return { trackCount: audioTracks.length, clipCount };
  }, [sequence]);

  useEffect(() => {
    if (!mediaManager) return;
    const thumbnailCache = getThumbnailCache();
    videoAssetIdsNeedingThumbnails.forEach(async (assetId) => {
      if (thumbnailsCompletedRef.current.has(assetId)) return;
      if (thumbnailInflight.current.has(assetId)) return;
      const asset = project.mediaAssets[assetId];
      if (!asset) return;
      const cached = await thumbnailCache.get(assetId);
      if (cached?.length) {
        actions.updateMediaAsset(assetId, { thumbnails: cached, thumbnailCount: cached.length });
        thumbnailsCompletedRef.current.add(assetId);
        return;
      }
      const url = playbackUrlForAsset(asset);
      if (!url) return;
      thumbnailInflight.current.add(assetId);
      void mediaManager
        .generateThumbnails(assetId, url, asset.duration, 6, (partial) => {
          if (partial.length) {
            actions.updateMediaAsset(assetId, {
              thumbnails: partial,
              thumbnailCount: partial.length,
            });
          }
        })
        .then(async (thumbs) => {
          if (!thumbs?.length) return;
          await thumbnailCache.put(assetId, thumbs);
          actions.updateMediaAsset(assetId, { thumbnails: thumbs, thumbnailCount: thumbs.length });
          thumbnailsCompletedRef.current.add(assetId);
        })
        .catch((error) => console.warn("thumbnail generation failed", assetId, error))
        .finally(() => {
          thumbnailInflight.current.delete(assetId);
        });
    });
  }, [videoAssetIdsNeedingThumbnails, mediaManager, project, actions]);

  if (!sequence) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading CapCut experience…
      </div>
    );
  }

  const renderPropertiesPanel = () => {
    if (!selection.clipIds.length) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground/60">
          Select a clip to edit properties
        </div>
      );
    }

    const clipId = selection.clipIds[0];
    const clipInfo = (() => {
      for (const seq of project.sequences) {
        for (const track of seq.tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) {
            return { clip, asset: project.mediaAssets[clip.mediaId] };
          }
        }
      }
      return null;
    })();

    if (!clipInfo) {
      return <div className="p-4 text-sm">Clip not found</div>;
    }

    const beatStatus = getClipBeatAnalysisStatus(project, clipId);
    const hasBeats = beatStatus?.hasBeats ?? false;
    const isAnalyzing = beatAnalysisStatus?.status === "analyzing";

    return (
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Clip</p>
          <p className="text-sm font-medium">{clipInfo.asset?.name ?? clipId}</p>
        </div>
        {clipInfo.asset?.convexAssetId && (
          <div className="rounded-md border border-border bg-card/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className={clsx("h-4 w-4", isAnalyzing ? "text-blue-500 animate-pulse" : hasBeats ? "text-green-500" : "text-muted-foreground" )} />
              Beat Analysis
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasBeats
                ? `${beatStatus?.beatCount ?? 0} beats${beatStatus?.bpm ? ` • ${Math.round(beatStatus.bpm)} BPM` : ""}`
                : "No beats detected"}
            </p>
            <div className="mt-3 space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={isAnalyzing}
                onClick={async () => {
                  try {
                    await analyzeBeatMutation({ assetId: clipInfo.asset!.convexAssetId! });
                    toast.info("Beat analysis started");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed to analyze beats");
                  }
                }}
              >
                {isAnalyzing ? "Analyzing…" : hasBeats ? "Re-analyze" : "Analyze Beats"}
              </Button>
              {hasBeats && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setAutoSpliceClipId(clipId);
                    setAutoSpliceDialogOpen(true);
                  }}
                >
                  Auto-Splice on Beats
                </Button>
              )}
            </div>
          </div>
        )}
        <div className="rounded-md border border-border bg-card/40 p-3 text-xs text-muted-foreground">
          Advanced property editing coming soon.
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col bg-[#0b0b0d] text-white">
      <div className="border-b border-white/10 bg-[#0f0f12] px-6 py-3 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">OpenCut Mode</p>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="font-semibold">{project.title || "Untitled Project"}</span>
              <span className="text-white/40">•</span>
              <span>{sequence.duration.toFixed(1)}s</span>
              {propsProjectId && (
                <span className="text-white/40">ID: {propsProjectId}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant={liveMode === "modern" ? "default" : "ghost"}
              onClick={() => setLiveMode("modern")}
            >
              Modern
            </Button>
            <Button
              size="sm"
              variant={liveMode === "legacy" ? "default" : "ghost"}
              onClick={() => setLiveMode("legacy")}
            >
              Legacy
            </Button>
            <PageNavigation projectId={propsProjectId ?? convexProjectId ?? undefined} />
          </div>
        </div>
      </div>

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
        onToggleTimelineMode={() => setTimelineMode((prev) => (prev === "twick" ? "legacy" : "twick"))}
        masterVolume={masterVolume}
        onMasterVolumeChange={setMasterVolume}
        audioTrackMuted={audioTrackMuted}
        onToggleAudioTrack={() => setAudioTrackMuted((prev) => !prev)}
        rippleEditEnabled={rippleEditEnabled}
        onToggleRippleEdit={() => actions.toggleRippleEdit()}
        multiTrackRipple={multiTrackRipple}
        onToggleMultiTrackRipple={() => actions.toggleMultiTrackRipple()}
      />

      <div className="flex flex-1 overflow-hidden bg-[#050506]">
        <div className="w-[320px] border-r border-white/5 bg-[#0f0f12]/90 backdrop-blur">
          <div className="flex border-b border-white/5">
            {(["media", "voice"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftPanelTab(tab)}
                className={clsx(
                  "flex-1 border-b-2 px-4 py-3 text-sm font-semibold",
                  leftPanelTab === tab
                    ? "border-white text-white"
                    : "border-transparent text-white/40 hover:text-white/80",
                )}
              >
                {tab === "media" ? "Media" : "Voice"}
              </button>
            ))}
          </div>
          <div className="h-full overflow-y-auto p-3">
            {leftPanelTab === "media" ? (
              <MediaPanel
                assets={assets}
                onImport={handleImport}
                onAddToTimeline={(assetId) => actions.appendClipFromAsset(assetId)}
                convexProjectId={convexProjectId}
              />
            ) : (
              <VoiceGenerationPanel
                onAssetCreated={(asset) => {
                  actions.addMediaAsset(asset);
                  actions.appendClipFromAsset(asset.id);
                  toast.success("Voice added to timeline!");
                }}
                autoAddToTimeline
              />
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 border-b border-white/5 bg-gradient-to-b from-black to-[#050506]">
            <div className="flex flex-1 flex-col">
              {timelineMode === "twick" ? (
                <div className="flex-1 bg-black flex items-center justify-center">
                  <LivePlayer
                    project={twickPlayerProject}
                    playing={isPlaying}
                    currentTime={currentTime}
                    volume={masterVolume}
                    controls={false}
                    looping
                    width={sequence.width}
                    height={sequence.height}
                    onTimeUpdate={(time: number) => actions.setCurrentTime(time)}
                  />
                </div>
              ) : (
                <PreviewPanel
                  canvasRef={canvasRef}
                  currentTime={currentTime}
                  duration={sequence.duration}
                  isPlaying={isPlaying}
                  onTogglePlayback={() => actions.togglePlayback()}
                  onSeek={(time) => actions.setCurrentTime(time)}
                />
              )}
            </div>
            <div className="w-[320px] border-l border-white/5 bg-[#0f0f12]/70">
              {renderPropertiesPanel()}
            </div>
          </div>

          <div className="h-[360px] border-t border-white/5 bg-[#0b0b0d]">
            <EditorController />
          </div>
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
            toast.success(`Spliced clip into ${result.cutCount + 1} clips`);
          } else {
            toast.error(result.error ?? "Failed to splice clip");
          }
        }}
      />
    </div>
  );
};

export default OpenCutEditorShell;
