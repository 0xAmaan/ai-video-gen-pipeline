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

  if (typeof window !== "undefined") {
    console.log("[StoryboardPage] projectId", projectId);
    console.log("[StoryboardPage] projectProgress", projectProgress);
    console.log("[StoryboardPage] storyboardRows", storyboardRows);
    console.log("[StoryboardPage] selectionsComplete", selectionsComplete);
    console.log("[StoryboardPage] isSyncing", isSyncing);
  }

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
      console.warn("[StoryboardPage] Skipping poll", {
        clipId,
        predictionId,
        alreadyPolling: activeVideoPolls.current.has(clipId),
      });
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
        console.log("[StoryboardPage] Poll tick", {
          clipId,
          predictionId,
          status: result.status,
          attempts,
        });

        if (result.status === "complete") {
          await updateVideoClip({
            clipId,
            status: "complete",
            videoUrl: result.videoUrl,
          });
          activeVideoPolls.current.delete(clipId);
          console.log("[StoryboardPage] Clip complete", {
            clipId,
            predictionId,
            videoUrl: result.videoUrl,
          });
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
          activeVideoPolls.current.delete(clipId);
          console.error("[StoryboardPage] Poll aborted after max attempts", {
            clipId,
            predictionId,
          });
        }
      }
    };

    poll();
  };

  // Video generation function
  const generateVideoClips = async () => {
    try {
      console.log("[StoryboardPage] Starting video generation", {
        sceneCount: convexScenes.length,
        selectedVideoModel,
      });

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

      // Prepare scenes data for API
      const scenesData = convexScenes.map((scene) => ({
        id: scene._id,
        sceneNumber: scene.sceneNumber,
        imageUrl: scene.imageUrl || "",
        description: scene.description,
        duration: scene.duration,
      }));

      console.log("[StoryboardPage] Prepared scenes for generation:", scenesData.length);

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
      console.log("[StoryboardPage] generate-all-clips response", result);

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
          console.log("[StoryboardPage] Created clip record", {
            clipId,
            predictionId: prediction.predictionId,
            sceneId,
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
      console.log("[StoryboardPage] Clip predictions queued, polling started");

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
      console.log("[TRACE] Starting shot collection for sync", {
        rowCount: storyboardRows.length,
      });

      storyboardRows.forEach((row, rowIndex) => {
        console.log(`[TRACE] Row ${rowIndex}: scene ${row.scene.sceneNumber}`, {
          shotCount: row.shots.length,
        });

        row.shots.forEach((shotWrapper, shotIndex) => {
          console.log(`[TRACE] Row ${rowIndex}, Shot ${shotIndex}:`, {
            shotId: shotWrapper.shot._id,
            shotNumber: shotWrapper.shot.shotNumber,
            hasSelectedImage: !!shotWrapper.selectedImage,
            selectedImageId: shotWrapper.selectedImage?._id,
            imageUrl: shotWrapper.selectedImage?.imageUrl,
          });

          if (!shotWrapper.selectedImage) {
            console.warn(`[TRACE] Shot ${shotWrapper.shot._id} has NO selectedImage - SKIPPING SYNC`);
            return;
          }

          const shotId = shotWrapper.shot._id;
          if (syncedShotIds.current.has(shotId)) {
            console.log(`[TRACE] Shot ${shotId} already synced - SKIPPING`);
            return;
          }

          const syncItem = {
            projectId,
            sceneId: row.scene._id,
            shotId,
            selectedImageId: shotWrapper.selectedImage._id,
          };

          console.log(`[TRACE] Adding shot to sync queue:`, {
            ...syncItem,
            imageUrl: shotWrapper.selectedImage.imageUrl,
            imageStorageId: shotWrapper.selectedImage.imageStorageId,
            FULL_IMAGE_OBJECT: shotWrapper.selectedImage,
          });

          shotsToSync.push(syncItem);
        });
      });

      console.log("[TRACE] Shot collection complete", {
        totalToSync: shotsToSync.length,
        shotsData: shotsToSync,
      });

      if (shotsToSync.length === 0) {
        console.log("[TRACE] No shots to sync - exiting");
        return;
      }

      setIsSyncing(true);
      console.log("[StoryboardPage] Starting sync of", shotsToSync.length, "shots");

      try {
        // Sync all shots in parallel and wait for all to complete
        await Promise.all(
          shotsToSync.map(async (syncData, index) => {
            try {
              syncedShotIds.current.add(syncData.shotId);
              console.log(`[TRACE] Syncing shot ${index + 1}/${shotsToSync.length}:`, syncData);
              await syncShotToLegacyScene(syncData);
              console.log(`[TRACE] ✓ Shot ${index + 1} synced successfully`);
            } catch (error) {
              console.error(`[TRACE] ✗ Shot ${index + 1} sync FAILED:`, error);
              syncedShotIds.current.delete(syncData.shotId);
              throw error;
            }
          })
        );
        console.log("[TRACE] ✓✓✓ ALL SHOTS SYNCED SUCCESSFULLY ✓✓✓");
      } catch (error) {
        console.error("[TRACE] ✗✗✗ SHOT SYNC ERROR ✗✗✗", error);
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
      console.log("[StoryboardPage] Resuming polling for", processingClips.length, "clips");
      processingClips.forEach((clip) => {
        if (clip.replicateVideoId && !activeVideoPolls.current.has(clip._id)) {
          console.log("[StoryboardPage] Starting poll for clip", clip._id);
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
            videoLocked={!selectionsComplete || isSyncing}
            videoLockMessage={
              isSyncing
                ? "Preparing scenes for video generation..."
                : "Select master shots for every scene to unlock video generation"
            }
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
                console.log("[StoryboardPage] Generate Videos clicked", {
                  projectId,
                  canGenerateVideo,
                  selectionsComplete,
                  isSyncing,
                  isGenerating,
                });

                // Wait for any ongoing sync to complete
                if (isSyncing) {
                  console.log("[StoryboardPage] Waiting for sync to complete...");
                  return;
                }

                // Don't start if already generating
                if (isGenerating) {
                  console.log("[StoryboardPage] Already generating...");
                  return;
                }

                // Clear old video clips before generating
                if (projectId) {
                  console.log("[StoryboardPage] Clearing old video clips...");
                  try {
                    const clearedCount = await clearVideoClips({ projectId });
                    console.log(`[StoryboardPage] Cleared ${clearedCount} old clips`);
                  } catch (error) {
                    console.error("[StoryboardPage] Failed to clear clips:", error);
                    return;
                  }
                }

                // Start video generation inline
                hasStartedGeneration.current = true;
                setIsGenerating(true);
                await generateVideoClips();
              }}
            >
              {isSyncing ? "Preparing..." : isGenerating ? "Generating..." : "Generate Videos"}
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
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StoryboardPage;
