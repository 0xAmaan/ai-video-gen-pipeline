"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { StoryboardSceneRow } from "@/components/redesign/StoryboardSceneRow";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import {
  useStoryboardRows,
  useAllMasterShotsSet,
  useProjectProgress,
  useSyncShotToLegacyScene,
} from "@/lib/hooks/useProjectRedesign";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useImageToVideoModel, useModelSelectionEnabled } from "@/lib/stores/modelStore";
import { apiFetch } from "@/lib/api-fetch";

const StoryboardPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;
  const storyboardRows = useStoryboardRows(projectId);
  const allMasterShotsSet = useAllMasterShotsSet(projectId);
  const projectProgress = useProjectProgress(projectId);
  const selectionsComplete = Boolean(projectProgress?.isSelectionComplete);
  const syncShotToLegacyScene = useSyncShotToLegacyScene();
  const clearVideoClips = useMutation(api.video.clearVideoClips);
  const syncedShotIds = useRef<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);

  // Video generation state
  const selectedVideoModel = useImageToVideoModel();
  const modelSelectionEnabled = useModelSelectionEnabled();
  const [isGenerating, setIsGenerating] = useState(false);
  const hasStartedGeneration = useRef(false);
  const activeVideoPolls = useRef(new Set<string>());

  // Convex queries and mutations for video
  const convexScenes = useQuery(api.video.getScenes, projectId ? { projectId } : "skip") || [];
  const clips = useQuery(api.video.getVideoClips, projectId ? { projectId } : "skip") || [];
  const createVideoClip = useMutation(api.video.createVideoClip);
  const updateVideoClip = useMutation(api.video.updateVideoClip);
  const updateProjectModelSelection = useMutation(api.video.updateProjectModelSelection);
  const updateProjectStatus = useMutation(api.video.updateProjectStatus);

  const canGenerateVideo = Boolean(projectId) && selectionsComplete && !isSyncing && !isGenerating;

  // Retry handler for individual clips
  const retryVideoClip = async (clipId: Id<"videoClips">, sceneId: Id<"scenes">) => {
    try {
      // Find the scene data
      const scene = convexScenes.find((s) => s._id === sceneId);
      if (!scene) {
        console.error("[StoryboardPage] Scene not found for retry", sceneId);
        return;
      }

      // Validate required fields
      if (!scene.imageUrl) {
        console.error("[StoryboardPage] Scene missing imageUrl - cannot retry");
        alert("Scene is missing image URL. Cannot retry video generation.");
        return;
      }

      // Call retry API
      const response = await apiFetch("/api/retry-video-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene._id,
          imageUrl: scene.imageUrl,
          description: scene.description,
          visualPrompt: scene.visualPrompt,
          sceneNumber: scene.sceneNumber,
          duration: scene.duration,
          videoModel: selectedVideoModel,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        console.error("[StoryboardPage] retry-video-clip failed", errorBody);
        throw new Error(errorBody?.error || "Failed to retry video clip");
      }

      const result = await response.json();

      // Update the clip with new prediction ID
      await updateVideoClip({
        clipId,
        status: "pending",
        replicateVideoId: result.predictionId,
        errorMessage: undefined,
        videoUrl: undefined,
      });

      // Start polling the new prediction
      if (result.predictionId) {
        startPolling(clipId, result.predictionId, sceneId);
      }
    } catch (error) {
      console.error("[StoryboardPage] Error retrying clip:", error);
    }
  };

  const [selectedShotId, setSelectedShotId] = useState<Id<"sceneShots"> | null>(
    null,
  );

  // Video polling function
  const startPolling = (
    clipId: Id<"videoClips">,
    predictionId: string,
    sceneId: Id<"scenes">,
  ) => {
    if (!predictionId || activeVideoPolls.current.has(clipId)) {
      return;
    }

    activeVideoPolls.current.add(clipId);
    const pollInterval = 5000; // 5 seconds
    const maxAttempts = 180; // 15 minutes max (180 * 5s)
    let attempts = 0;

    const poll = async () => {
      attempts += 1;

      try {
        const response = await apiFetch("/api/poll-prediction", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ predictionId }),
        });

        const result = await response.json();

        if (result.status === "complete") {
          await updateVideoClip({
            clipId,
            status: "complete",
            videoUrl: result.videoUrl,
          });
          activeVideoPolls.current.delete(clipId);
          // Skip lipsync - just mark as complete
          return;
        }

        if (result.status === "failed") {
          await updateVideoClip({
            clipId,
            status: "failed",
            errorMessage: result.errorMessage || "Video generation failed",
          });
          activeVideoPolls.current.delete(clipId);
          console.error("[StoryboardPage] Clip failed while polling", {
            clipId,
            predictionId,
            error: result.errorMessage,
          });
          return;
        }

        if (
          result.status === "processing" ||
          result.status === "starting"
        ) {
          await updateVideoClip({
            clipId,
            status: "processing",
          });

          if (attempts < maxAttempts) {
            setTimeout(poll, pollInterval);
          } else {
            // Timeout after max attempts - mark as failed
            await updateVideoClip({
              clipId,
              status: "failed",
              errorMessage: "Video generation timed out after 15 minutes. Please try again.",
            });
            activeVideoPolls.current.delete(clipId);
          }
        }
      } catch (error) {
        console.error("Error polling prediction:", error, {
          clipId,
          predictionId,
          attempts,
        });
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          // Network error exceeded max attempts - mark as failed
          await updateVideoClip({
            clipId,
            status: "failed",
            errorMessage: error instanceof Error
              ? `Polling failed: ${error.message}`
              : "Network error while checking video status. Please retry.",
          });
          activeVideoPolls.current.delete(clipId);
        }
      }
    };

    poll();
  };

  // Video generation function
  const generateVideoClips = async () => {
    try {
      if (modelSelectionEnabled && selectedVideoModel) {
        try {
          await updateProjectModelSelection({
            projectId: projectId as Id<"videoProjects">,
            stage: "video",
            modelId: selectedVideoModel,
          });
        } catch (error) {
          console.error("Failed to record video model selection:", error);
        }
      }

      // Filter out scenes that already have complete clips
      const completedSceneIds = new Set(
        clips
          .filter((clip) => clip.status === "complete")
          .map((clip) => clip.sceneId)
      );

      // Only generate for scenes without complete clips
      const scenesToGenerate = convexScenes.filter(
        (scene) => !completedSceneIds.has(scene._id)
      );

      if (scenesToGenerate.length === 0) {
        setIsGenerating(false);
        return;
      }

      // Prepare scenes data for API
      const scenesData = scenesToGenerate.map((scene) => ({
        id: scene._id,
        sceneNumber: scene.sceneNumber,
        imageUrl: scene.imageUrl || "",
        description: scene.description,
        duration: scene.duration,
      }));

      // Call API to create Replicate predictions
      const response = await apiFetch("/api/generate-all-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenesData,
          videoModel: selectedVideoModel,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        console.error("[StoryboardPage] generate-all-clips failed", errorBody);
        throw new Error(
          errorBody?.error || "Failed to generate video clips",
        );
      }

      const result = await response.json();

      // Create video clip records in Convex with prediction IDs
      const clipRecords = await Promise.all(
        result.predictions.map(async (prediction: any) => {
          const sceneId = prediction.sceneId as Id<"scenes">;
          const clipId = await createVideoClip({
            sceneId,
            projectId: projectId as Id<"videoProjects">,
            duration: prediction.duration,
            resolution: "720p",
            replicateVideoId: prediction.predictionId,
          });
          return { clipId, predictionId: prediction.predictionId, sceneId };
        }),
      );

      // Start polling each prediction
      clipRecords.forEach(({ clipId, predictionId, sceneId }) => {
        if (predictionId) {
          startPolling(clipId, predictionId, sceneId);
        }
      });

      setIsGenerating(false);

      // Update project status when all videos complete
      const checkAllComplete = () => {
        const allComplete = clips.every(clip => clip.status === "complete");
        if (allComplete && clips.length > 0) {
          updateProjectStatus({
            projectId: projectId as Id<"videoProjects">,
            status: "video_generated",
          }).catch(error => console.error("Failed to update project status:", error));
        }
      };

      // Check completion status after a delay
      setTimeout(checkAllComplete, 2000);
    } catch (error) {
      console.error("Error generating video clips:", error);
      setIsGenerating(false);
      hasStartedGeneration.current = false; // Allow retry
    }
  };

  useEffect(() => {
    if (!storyboardRows || !projectId) return;

    const syncAllShots = async () => {
      const shotsToSync: Array<{
        projectId: Id<"videoProjects">;
        sceneId: Id<"projectScenes">;
        shotId: Id<"sceneShots">;
        selectedImageId: Id<"shotImages">;
      }> = [];

      // Collect all shots that need syncing
      storyboardRows.forEach((row) => {
        row.shots.forEach((shotWrapper) => {
          if (!shotWrapper.selectedImage) {
            return;
          }

          const shotId = shotWrapper.shot._id;
          if (syncedShotIds.current.has(shotId)) {
            return;
          }

          const syncItem = {
            projectId,
            sceneId: row.scene._id,
            shotId,
            selectedImageId: shotWrapper.selectedImage._id,
          };

          shotsToSync.push(syncItem);
        });
      });

      if (shotsToSync.length === 0) {
        return;
      }

      setIsSyncing(true);

      try {
        // Sync all shots in parallel and wait for all to complete
        await Promise.all(
          shotsToSync.map(async (syncData) => {
            try {
              syncedShotIds.current.add(syncData.shotId);
              await syncShotToLegacyScene(syncData);
            } catch (error) {
              console.error("[StoryboardPage] Shot sync failed:", error);
              syncedShotIds.current.delete(syncData.shotId);
              throw error;
            }
          })
        );
      } catch (error) {
        console.error("[StoryboardPage] Shot sync error:", error);
      } finally {
        setIsSyncing(false);
      }
    };

    syncAllShots();
  }, [storyboardRows, projectId, syncShotToLegacyScene]);

  // Resume polling for clips that are still processing (on page load/refresh)
  useEffect(() => {
    if (!clips || clips.length === 0) return;

    const processingClips = clips.filter(
      (clip) => clip.status === "processing" || clip.status === "pending",
    );

    if (processingClips.length > 0) {
      processingClips.forEach((clip) => {
        if (clip.replicateVideoId && !activeVideoPolls.current.has(clip._id)) {
          startPolling(clip._id, clip.replicateVideoId, clip.sceneId);
        }
      });
    }
  }, [clips?.length]); // Only run when clips array length changes

  if (!projectId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Missing project context.
      </div>
    );
  }

  const hasRows = !!storyboardRows && storyboardRows.length > 0;

  // Don't lock storyboard when we're already on this page
  // (only lock it when viewing from other pages)
  const lockMessage = !allMasterShotsSet
    ? "Set up master shots for all scenes in Scene Planner"
    : undefined;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-gray-900 px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Storyboard
            </p>
            <h1 className="text-2xl font-bold">Selected master shots</h1>
            <p className="text-sm text-gray-400 mt-1">
              Review each scene&apos;s chosen frames before animation.
            </p>
          </div>

          <PageNavigation
            projectId={projectId}
            storyboardLocked={false}
            storyboardLockMessage={lockMessage}
            editorLocked={projectProgress?.projectStatus !== "video_generated"}
            editorLockMessage="Generate video clips before editing"
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-gray-700 text-gray-200 hover:bg-gray-800"
              onClick={() => router.push(`/${projectId}/scene-planner`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Planner
            </Button>
            <Button
              className="bg-white text-black hover:bg-gray-200"
              disabled={!canGenerateVideo}
              onClick={async () => {
                // Wait for any ongoing sync to complete
                if (isSyncing) {
                  return;
                }

                // Don't start if already generating
                if (isGenerating) {
                  return;
                }

                // Only clear failed/incomplete clips, keep complete ones
                // Note: clearVideoClips clears all clips. For a more selective approach,
                // we'd need a new Convex mutation. For now, we'll just skip clearing
                // and let generateVideoClips filter out complete scenes.

                // Start video generation inline
                hasStartedGeneration.current = true;
                setIsGenerating(true);
                await generateVideoClips();
              }}
            >
              {isSyncing ? "Preparing..." : isGenerating ? "Generating..." : (() => {
                const completedCount = clips.filter(c => c.status === "complete").length;
                const totalCount = convexScenes.length;
                if (completedCount === 0) {
                  return "Generate Videos";
                } else if (completedCount === totalCount) {
                  return "All Videos Complete";
                } else {
                  return `Generate ${totalCount - completedCount} Video${totalCount - completedCount === 1 ? "" : "s"}`;
                }
              })()}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 space-y-4">
        {!storyboardRows ? (
          <div className="text-gray-500 text-center py-20 border border-dashed border-gray-800 rounded-3xl">
            Loading storyboard...
          </div>
        ) : !hasRows ? (
          <div className="text-gray-500 text-center py-20 border border-dashed border-gray-800 rounded-3xl">
            No storyboard selections yet. Select master shots in the iterator to
            populate this view.
          </div>
        ) : (
          storyboardRows.map((row) => (
            <StoryboardSceneRow
              key={row.scene._id}
              scene={row}
              selectedShotId={selectedShotId}
              onShotSelect={(shotId) => setSelectedShotId(shotId)}
              clips={clips}
              convexScenes={convexScenes}
              isGenerating={isGenerating}
              isLocked={isGenerating}
              onRetryClip={retryVideoClip}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StoryboardPage;
