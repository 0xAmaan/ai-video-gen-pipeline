"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Film, AlertCircle, Mic, XCircle } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Scene } from "@/types/scene";
import { apiFetch } from "@/lib/api-fetch";

interface VideoGeneratingPhaseProps {
  scenes: Scene[];
  projectId: Id<"videoProjects">;
  onComplete: (clips: any[]) => void;
  enableLipsync: boolean;
  onToggleLipsync: (value: boolean) => void;
}

export const VideoGeneratingPhase = ({
  scenes,
  projectId,
  onComplete,
  enableLipsync,
  onToggleLipsync,
}: VideoGeneratingPhaseProps) => {
  // Query video clips from Convex to track real-time status
  const videoClips = useQuery(api.video.getVideoClips, { projectId });
  const cancelVideoClip = useMutation(api.video.cancelVideoClip);
  const hasCalledComplete = useRef(false);
  const [cancelling, setCancelling] = useState<Set<Id<"videoClips">>>(new Set());

  useEffect(() => {
    if (videoClips) {
      console.log("[VideoGeneratingPhase] Clips update", videoClips);
    }
  }, [videoClips]);

  const handleCancelClip = async (clipId: Id<"videoClips">, predictionId?: string) => {
    try {
      setCancelling((prev) => new Set(prev).add(clipId));

      // Cancel on Replicate if we have a prediction ID
      if (predictionId) {
        await apiFetch("/api/cancel-prediction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ predictionId }),
        });
      }

      // Update status in Convex
      await cancelVideoClip({ clipId });
    } catch (error) {
      console.error("Failed to cancel clip:", error);
    } finally {
      setCancelling((prev) => {
        const next = new Set(prev);
        next.delete(clipId);
        return next;
      });
    }
  };

  const handleCancelAll = async () => {
    const processingClips = videoClips?.filter(
      (clip) => clip.status === "pending" || clip.status === "processing"
    );

    if (!processingClips || processingClips.length === 0) return;

    await Promise.all(
      processingClips.map((clip) =>
        handleCancelClip(clip._id, clip.replicateVideoId || undefined)
      )
    );
  };

  // Calculate progress
  const totalClips = scenes.length || 1;
  const completedClips =
    videoClips?.filter((c) => c.status === "complete").length || 0;
  const failedClips =
    videoClips?.filter((c) => c.status === "failed").length || 0;
  const cancelledClips =
    videoClips?.filter((c) => c.status === "cancelled").length || 0;
  const processingClips =
    videoClips?.filter(
      (c) => c.status === "processing" || c.status === "pending",
    ).length || 0;
  const videoProgress = enableLipsync
    ? (completedClips / totalClips) * 50
    : (completedClips / totalClips) * 100;
  const lipsyncCompleteScenes = scenes.filter((scene) => {
    if (!enableLipsync) return true;
    if (!scene.narrationUrl) return true;
    return scene.lipsyncStatus === "complete";
  }).length;
  const lipsyncProcessingScenes =
    scenes.filter((scene) => scene.lipsyncStatus === "processing").length || 0;
  const lipsyncFailedScenes =
    scenes.filter((scene) => scene.lipsyncStatus === "failed").length || 0;
  const lipsyncProgress = enableLipsync
    ? (lipsyncCompleteScenes / totalClips) * 50
    : 0;
  const totalProgress = Math.min(100, videoProgress + lipsyncProgress);
  const videoGenerationComplete =
    videoClips && completedClips + failedClips === totalClips;
  const lipsyncSettled = scenes.every((scene) => {
    if (!enableLipsync || !scene.narrationUrl) return true;
    return (
      scene.lipsyncStatus === "complete" || scene.lipsyncStatus === "failed"
    );
  });
  const readyForEditor =
    Boolean(videoGenerationComplete) && Boolean(lipsyncSettled);
  const lipsyncEligibleCount =
    scenes.filter((scene) => !!scene.narrationUrl).length || 0;
  const lipsyncToggleLocked = completedClips > 0;
  const imageCost = scenes.length * 0.08;
  const audioCost = scenes.length * 0.01;
  const videoCost = scenes.length * 0.34;
  const lipsyncCost = enableLipsync
    ? scenes.reduce((sum, scene) => sum + (scene.duration || 0) * 0.05, 0)
    : 0;
  const estimatedCost = imageCost + audioCost + videoCost + lipsyncCost;

  // Trigger completion callback in useEffect to avoid state update during render
  useEffect(() => {
    if (readyForEditor && videoClips && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      onComplete(videoClips);
    }
  }, [readyForEditor, videoClips, onComplete, completedClips]);

  // Map video clips to scenes for display
  const getClipForScene = (sceneId: string) => {
    return videoClips?.find((clip) => clip.sceneId === sceneId);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-4xl px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Film className="w-8 h-8 text-primary animate-pulse" />
            <h1 className="text-3xl font-bold">Generating Video Clips</h1>
          </div>
          <p className="text-muted-foreground">
            {readyForEditor
              ? failedClips + lipsyncFailedScenes + cancelledClips > 0
                ? `Generation finished with ${failedClips + lipsyncFailedScenes} failed, ${cancelledClips} cancelled`
                : "All clips generated and audio synced!"
              : enableLipsync
                ? `Generating videos (${completedClips}/${totalClips}) • Lip sync ${Math.min(lipsyncCompleteScenes, totalClips)}/${totalClips}`
                : `Generating videos (${completedClips}/${totalClips})...`}
          </p>
          {processingClips > 0 && (
            <div className="mt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelAll}
                className="gap-2"
              >
                <XCircle className="w-4 h-4" />
                Cancel All ({processingClips})
              </Button>
            </div>
          )}
        </div>

        {/* Overall Progress */}
        <Card className="p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">
                Overall Progress{enableLipsync ? " (Video + Lip Sync)" : ""}
              </span>
              <span className="text-2xl font-bold text-primary">
                {Math.round(totalProgress)}%
              </span>
            </div>
            <Progress value={totalProgress} className="h-3" />
          </div>

          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <span className="text-muted-foreground">
              Videos {completedClips}/{totalClips} • Lip sync{" "}
              {enableLipsync
                ? `${Math.min(lipsyncCompleteScenes, totalClips)}/${totalClips}`
                : "disabled"}
            </span>
            <Badge variant="secondary">Using WAN 2.5 i2v Fast</Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={enableLipsync}
                onChange={(event) => onToggleLipsync(event.target.checked)}
                disabled={lipsyncToggleLocked}
              />
              <span>
                Enable lip sync (adds ~$0.25/clip)
                {lipsyncToggleLocked && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (locked after generation starts)
                  </span>
                )}
              </span>
            </label>
            <span className="text-muted-foreground">
              {processingClips > 0
                ? `Video stage: ${processingClips} clip(s) processing`
                : readyForEditor
                  ? "Video stage complete"
                  : "Queueing clips..."}
            </span>
          </div>
        </Card>

        <Card className="p-4 mb-6">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Debug Details
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            Total clips: {videoClips?.length ?? 0} • Pending/polling:{" "}
            {videoClips?.filter(
              (clip) => clip.status === "pending" || clip.status === "processing",
            ).length ?? 0}
          </p>
          {videoClips && videoClips.length > 0 ? (
            <div className="max-h-48 overflow-auto rounded border border-muted bg-muted/20 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="px-2 py-1">Scene</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {videoClips.map((clip) => (
                    <tr key={clip._id}>
                      <td className="px-2 py-1 text-muted-foreground">
                        #{clip.sceneNumber ?? clip.sceneId}
                      </td>
                      <td className="px-2 py-1">{clip.status}</td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {clip.replicateVideoId || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Waiting for clip records to be created…
            </p>
          )}
        </Card>

        {/* Video Clips Grid */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Film className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Video Clip Generation</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scenes.map((scene, index) => {
              const clip = getClipForScene(scene.id);
              const hasVideo = clip?.status === "complete";
              const hasFailed = clip?.status === "failed";
              const isCancelled = clip?.status === "cancelled";
              const isProcessing =
                clip?.status === "processing" || clip?.status === "pending";
              const isCancelling = clip?._id ? cancelling.has(clip._id) : false;

              return (
                <div
                  key={scene.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    hasVideo
                      ? "border-primary/30 bg-accent/30"
                      : hasFailed
                        ? "border-destructive/30 bg-destructive/5"
                        : isCancelled
                          ? "border-muted bg-muted/10"
                          : isProcessing
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className="shrink-0 mt-1">
                      {hasVideo ? (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-5 h-5 text-primary-foreground" />
                        </div>
                      ) : hasFailed ? (
                        <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-destructive-foreground" />
                        </div>
                      ) : isCancelled ? (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-muted-foreground" />
                        </div>
                      ) : isProcessing ? (
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-border flex items-center justify-center">
                          <span className="text-sm text-muted-foreground">
                            {index + 1}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Scene Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h4 className="font-medium text-sm">
                          Scene {scene.sceneNumber}
                        </h4>
                        {hasVideo && (
                          <Badge variant="default" className="text-xs">
                            Complete
                          </Badge>
                        )}
                        {hasFailed && (
                          <Badge variant="destructive" className="text-xs">
                            Failed
                          </Badge>
                        )}
                        {isCancelled && (
                          <Badge variant="secondary" className="text-xs">
                            Cancelled
                          </Badge>
                        )}
                        {isProcessing && (
                          <>
                            <Badge variant="default" className="text-xs">
                              Generating...
                            </Badge>
                            {clip && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelClip(clip._id, clip.replicateVideoId || undefined)}
                                disabled={isCancelling}
                                className="h-6 px-2 text-xs"
                              >
                                {isCancelling ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {scene.description}
                      </p>

                      {/* Duration */}
                      <div className="text-xs text-muted-foreground mb-2">
                        Duration: {scene.duration}s
                      </div>

                      {/* Video Preview or Error */}
                      {hasVideo && clip.videoUrl && (
                        <div className="mt-2 rounded-md overflow-hidden border border-border">
                          <video
                            src={clip.videoUrl}
                            controls
                            className="w-full h-24 object-cover"
                            muted
                          />
                        </div>
                      )}

                      {hasFailed && clip.errorMessage && (
                        <div className="mt-2 text-xs text-destructive">
                          Error: {clip.errorMessage}
                        </div>
                      )}

                      {/* Source Image Preview */}
                      {!hasVideo && !hasFailed && scene.image && (
                        <div className="mt-2 rounded-md overflow-hidden border border-border opacity-50">
                          <img
                            src={scene.image}
                            alt={`Scene ${index + 1}`}
                            className="w-full h-24 object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {enableLipsync ? (
          <Card className="p-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Mic className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Lip Sync Processing</h3>
            </div>
            <Progress
              value={(lipsyncCompleteScenes / totalClips) * 100}
              className="h-2 mb-2"
            />
            <p className="text-sm text-muted-foreground">
              {Math.min(lipsyncCompleteScenes, totalClips)}/{totalClips} clips
              synced
            </p>
            {lipsyncProcessingScenes > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Processing {lipsyncProcessingScenes} clip(s)...
              </p>
            )}
            {lipsyncEligibleCount === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Scenes without narration are automatically considered synced.
              </p>
            )}
            {lipsyncFailedScenes > 0 && (
              <p className="text-sm text-destructive mt-2">
                {lipsyncFailedScenes} clip(s) failed to sync. We’ll fall back to
                the original video.
              </p>
            )}
          </Card>
        ) : (
          <Card className="p-6 mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Lip Sync Disabled</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Original WAN clips will be used without additional processing.
            </p>
          </Card>
        )}

        {/* Cost Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Estimated cost:{" "}
            <span className="font-medium text-foreground">
              ${estimatedCost.toFixed(2)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Images ${imageCost.toFixed(2)} + Audio ${audioCost.toFixed(2)} +
            Video ${videoCost.toFixed(2)}
            {enableLipsync ? ` + Lip Sync $${lipsyncCost.toFixed(2)}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
};
