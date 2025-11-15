"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Film, AlertCircle } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

interface Scene {
  id: string;
  sceneNumber: number;
  description: string;
  imageUrl?: string;
  duration: number;
}

interface VideoGeneratingPhaseProps {
  scenes: Scene[];
  projectId: Id<"videoProjects">;
  onComplete: (clips: any[]) => void;
}

export const VideoGeneratingPhase = ({
  scenes,
  projectId,
  onComplete,
}: VideoGeneratingPhaseProps) => {
  // Query video clips from Convex to track real-time status
  const videoClips = useQuery(api.video.getVideoClips, { projectId });
  const hasCalledComplete = useRef(false);

  // Calculate progress
  const totalClips = scenes.length;
  const completedClips = videoClips?.filter((c) => c.status === "complete").length || 0;
  const failedClips = videoClips?.filter((c) => c.status === "failed").length || 0;
  const processingClips = videoClips?.filter((c) => c.status === "processing").length || 0;
  const progress = (completedClips / totalClips) * 100;

  // Check if all clips are done
  const allComplete = videoClips && completedClips + failedClips === totalClips;

  // Trigger completion callback in useEffect to avoid state update during render
  useEffect(() => {
    if (allComplete && !failedClips && videoClips && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      onComplete(videoClips);
    }
  }, [allComplete, failedClips, videoClips, onComplete]);

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
            {allComplete
              ? failedClips > 0
                ? `Generation complete with ${failedClips} failed clip(s)`
                : "All clips generated successfully!"
              : `Generating clips (${completedClips}/${totalClips})...`}
          </p>
        </div>

        {/* Overall Progress */}
        <Card className="p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-2xl font-bold text-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <span className="text-muted-foreground">
              {allComplete
                ? `Completed: ${completedClips} | Failed: ${failedClips}`
                : `Estimated time remaining: ${Math.ceil((totalClips - completedClips) * 90)}s`}
            </span>
            <Badge variant="secondary">Using WAN 2.5 i2v Fast</Badge>
          </div>
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
              const isProcessing = clip?.status === "processing" || clip?.status === "pending";

              return (
                <div
                  key={scene.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    hasVideo
                      ? "border-primary/30 bg-accent/30"
                      : hasFailed
                        ? "border-destructive/30 bg-destructive/5"
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
                      <div className="flex items-center gap-2 mb-2">
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
                        {isProcessing && (
                          <Badge variant="default" className="text-xs">
                            Generating...
                          </Badge>
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
                      {!hasVideo && !hasFailed && scene.imageUrl && (
                        <div className="mt-2 rounded-md overflow-hidden border border-border opacity-50">
                          <img
                            src={scene.imageUrl}
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

        {/* Cost Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Estimated cost:{" "}
            <span className="font-medium text-foreground">
              ${(totalClips * 0.34).toFixed(2)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
