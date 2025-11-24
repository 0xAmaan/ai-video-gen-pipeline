"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
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
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useImageToVideoModel,
  useModelSelectionEnabled,
  useModelStore,
} from "@/lib/stores/modelStore";
import { apiFetch } from "@/lib/api-fetch";
import { ChatInput } from "@/components/redesign/ChatInput";
import type { GenerationSettings } from "@/components/redesign/ChatSettings";
import { IMAGE_TO_VIDEO_MODELS } from "@/lib/types/models";
import { proxiedImageUrl } from "@/lib/redesign/image-proxy";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


const getAllowedDurationsForModel = (modelId: string): number[] => {
  if (modelId.includes("google/veo-3.1")) {
    return [4, 6, 8];
  }
  if (modelId.includes("wan-video") || modelId.includes("kling")) {
    return [5];
  }
  return [5];
};

const sanitizeDurationForModel = (
  modelId: string,
  requested?: number | null,
): number => {
  const allowed = getAllowedDurationsForModel(modelId);
  if (allowed.length === 0) return 5;
  if (requested === undefined || requested === null || Number.isNaN(requested)) {
    return allowed[0];
  }
  return allowed.reduce((prev, curr) =>
    Math.abs(curr - requested) < Math.abs(prev - requested) ? curr : prev,
  );
};

const VIDEO_MODEL_FALLBACK =
  IMAGE_TO_VIDEO_MODELS[0]?.id ?? "wan-video/wan-2.5-i2v-fast";

const StoryboardPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;
  const storyboardRows = useStoryboardRows(projectId);
  const allMasterShotsSet = useAllMasterShotsSet(projectId);
  const projectProgress = useProjectProgress(projectId);
  const selectionsComplete = Boolean(projectProgress?.isSelectionComplete);
  const syncShotToLegacyScene = useSyncShotToLegacyScene();
  const syncedShotIds = useRef<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const storyboardRootRef = useRef<HTMLDivElement | null>(null);

  // Video generation state
  const selectedVideoModel = useImageToVideoModel();
  const modelSelectionEnabled = useModelSelectionEnabled();
  const setImageToVideoModel = useModelStore(
    (state) => state.setImageToVideoModel,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const hasStartedGeneration = useRef(false);
  const activeVideoPolls = useRef(new Set<string>());
  const [videoChatValue, setVideoChatValue] = useState("");
  const getValidVideoModelId = useCallback(
    (requested?: string | null) => {
      if (requested) {
        const match = IMAGE_TO_VIDEO_MODELS.find(
          (model) => model.id === requested,
        );
        if (match) {
          return match.id;
        }
      }

      console.warn("[StoryboardPage] Invalid video model id, using fallback", {
        requested,
        fallback: VIDEO_MODEL_FALLBACK,
      });
      if (requested !== VIDEO_MODEL_FALLBACK) {
        setImageToVideoModel(VIDEO_MODEL_FALLBACK);
      }
      return VIDEO_MODEL_FALLBACK;
    },
    [setImageToVideoModel],
  );

  // Convex queries and mutations for video
  const convexScenes =
    useQuery(
      api.video.getScenes,
      projectId && isAuthenticated ? { projectId } : "skip",
    ) || [];
  const clips =
    useQuery(
      api.video.getVideoClips,
      projectId && isAuthenticated ? { projectId } : "skip",
    ) || [];
  const createVideoClip = useMutation(api.video.createVideoClip);
  const updateVideoClip = useMutation(api.video.updateVideoClip);
  const updateProjectModelSelection = useMutation(api.video.updateProjectModelSelection);
  const updateProjectStatus = useMutation(api.video.updateProjectStatus);

  const canGenerateVideo =
    Boolean(projectId) &&
    selectionsComplete &&
    !isSyncing &&
    !isGenerating &&
    isAuthenticated;

  // Helper function to check if all clips are complete and update project status
  const checkAllClipsComplete = React.useCallback(async () => {
    if (!projectId) return;
    
    const allComplete = clips.every(clip => clip.status === "complete");
    const hasClips = clips.length > 0;
    
    console.log("[StoryboardPage] Checking clip completion status", {
      totalClips: clips.length,
      completeClips: clips.filter(c => c.status === "complete").length,
      allComplete,
      currentProjectStatus: projectProgress?.projectStatus,
    });
    
    if (allComplete && hasClips && projectProgress?.projectStatus !== "video_generated") {
      console.log("[StoryboardPage] All clips complete! Updating project status to video_generated");
      try {
        await updateProjectStatus({
          projectId: projectId as Id<"videoProjects">,
          status: "video_generated",
        });
        console.log("[StoryboardPage] Project status updated successfully");
      } catch (error) {
        console.error("[StoryboardPage] Failed to update project status:", error);
      }
    }
  }, [projectId, clips, projectProgress?.projectStatus, updateProjectStatus]);
  
  // Debug logging for button state
  useEffect(() => {
    if (projectProgress) {
      console.log("[StoryboardPage] Editor button state:", {
        projectStatus: projectProgress.projectStatus,
        editorLocked: projectProgress.projectStatus !== "video_generated",
        shouldBeUnlocked: projectProgress.projectStatus === "video_generated",
      });
    }
  }, [projectProgress?.projectStatus]);
  
  // Check completion status whenever clips change
  useEffect(() => {
    if (clips.length > 0 && !isGenerating) {
      checkAllClipsComplete();
    }
  }, [clips, isGenerating, checkAllClipsComplete]);

  // Retry handler for individual clips
  const retryVideoClip = async (
    clipId: Id<"videoClips">,
    sceneId: Id<"scenes">,
    promptOverride?: string,
    modelOverride?: string,
    durationOverride?: number,
    audioOn?: boolean,
  ) => {
    if (!isAuthenticated) {
      toast.error("Please sign in to regenerate videos.");
      return;
    }
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

      const safeModelId = getValidVideoModelId(
        modelOverride ?? selectedVideoModel,
      );
      const supportsAudio = IMAGE_TO_VIDEO_MODELS.find(
        (model) => model.id === safeModelId,
      )?.supportsAudio;
      const durationToUse = sanitizeDurationForModel(
        safeModelId,
        durationOverride ?? scene.duration,
      );

      console.log("[StoryboardPage] Retrying clip", {
        clipId,
        sceneId,
        model: safeModelId,
        promptOverride,
      });

      // Call retry API
      const response = await apiFetch("/api/retry-video-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene._id,
          imageUrl: scene.imageUrl,
          description: scene.description,
          visualPrompt: promptOverride || scene.visualPrompt,
          sceneNumber: scene.sceneNumber,
          duration: durationToUse,
          generateAudio: supportsAudio ? Boolean(audioOn) : false,
          videoModel: safeModelId,
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
        errorMessage: "",
        videoUrl: "",
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
  const selectedShotDetails = useMemo(() => {
    if (!selectedShotId || !storyboardRows) {
      return null;
    }

    for (const row of storyboardRows) {
      const shotWrapper = row.shots.find(
        (shotGroup) => shotGroup.shot._id === selectedShotId,
      );
      if (shotWrapper) {
        const legacyScene = convexScenes.find(
          (scene) => scene.redesignShotId === selectedShotId,
        );
        return {
          sceneTitle: row.scene.title,
          sceneNumber: row.scene.sceneNumber,
          shotNumber: shotWrapper.shot.shotNumber,
          description: shotWrapper.shot.description,
          imageUrl:
            shotWrapper.selectedImage?.imageUrl ||
            legacyScene?.imageUrl ||
            null,
        };
      }
    }
    return null;
  }, [selectedShotId, storyboardRows, convexScenes]);

  const handleVideoChatSubmit = async (
    message: string,
    settings: GenerationSettings,
  ) => {
    if (!projectId || !selectedShotId) {
      console.warn("[StoryboardPage] Video chat submit requires a selected shot");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Please sign in to regenerate videos.");
      return;
    }

    if (!storyboardRows || storyboardRows.length === 0) {
      console.warn("[StoryboardPage] No storyboard rows available for video chat");
      return;
    }

    const targetRow = storyboardRows.find((row) =>
      row.shots.some((shotWrapper) => shotWrapper.shot._id === selectedShotId),
    );

    if (!targetRow) {
      console.warn("[StoryboardPage] Unable to find storyboard row for shot", selectedShotId);
      return;
    }

    const targetShotWrapper = targetRow.shots.find(
      (shotWrapper) => shotWrapper.shot._id === selectedShotId,
    );

    const legacyScene = convexScenes.find(
      (scene) => scene.redesignShotId === selectedShotId,
    );

    if (!legacyScene) {
      console.error("[StoryboardPage] No legacy scene found for selected shot", {
        selectedShotId,
      });
      return;
    }

    const promptOverride =
      message.trim() ||
      legacyScene.visualPrompt ||
      targetShotWrapper?.shot.description ||
      legacyScene.description ||
      "Cinematic, smooth motion video";

    const imageUrl =
      targetShotWrapper?.selectedImage?.imageUrl || legacyScene.imageUrl;

    if (!imageUrl) {
      console.error("[StoryboardPage] Missing image URL for scene", {
        sceneId: legacyScene._id,
      });
      alert("Unable to generate video - missing source image.");
      return;
    }

    console.log("[StoryboardPage] Video chat submission", {
      shotId: selectedShotId,
      model: settings.model,
      prompt: promptOverride,
    });

    setImageToVideoModel(settings.model);

    if (modelSelectionEnabled && settings.model) {
      try {
        await updateProjectModelSelection({
          projectId,
          stage: "video",
          modelId: settings.model,
        });
      } catch (error) {
        console.error("Failed to record video model selection:", error);
      }
    }

    const existingClip =
      clips.find((clip) => clip.sceneId === legacyScene._id) ?? null;
    const requestedDuration = settings.duration
      ? parseInt(settings.duration.replace(/\D/g, ""), 10)
      : undefined;
    const sanitizedDuration = sanitizeDurationForModel(
      settings.model,
      Number.isNaN(requestedDuration) ? undefined : requestedDuration,
    );

    try {
      if (existingClip) {
        await retryVideoClip(
          existingClip._id,
          legacyScene._id,
          promptOverride,
          settings.model,
          sanitizedDuration,
          settings.audioOn,
        );
      } else {
        await launchVideoPredictions(
          [
            {
              id: legacyScene._id,
              sceneNumber: legacyScene.sceneNumber,
              imageUrl,
              description:
                targetShotWrapper?.shot.description ?? legacyScene.description,
              visualPrompt: promptOverride,
              duration: sanitizedDuration,
              generateAudio: settings.audioOn,
            },
          ],
          settings.model,
        );
      }
      setVideoChatValue("");
      setSelectedShotId(null);
    } catch (error) {
      console.error("[StoryboardPage] Failed to handle video chat submit:", error);
    }
  };

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
          
          console.log("[StoryboardPage] Clip completed, checking if all clips done", { clipId });
          
          // Check if all clips are now complete and update project status
          checkAllClipsComplete();
          
          return;
        }

        if (result.status === "failed") {
          const errorMessage = result.errorMessage || "Video generation failed. Please try again.";
          await updateVideoClip({
            clipId,
            status: "failed",
            errorMessage,
          });
          activeVideoPolls.current.delete(clipId);
          toast.error("Video generation failed", {
            description: errorMessage,
          });
          console.error("[StoryboardPage] Clip failed while polling", {
            clipId,
            predictionId,
            error: errorMessage,
            fullResult: result, // Log full result to see what Replicate returned
          });
          // Show user-friendly alert with the error
          alert(`Video generation failed: ${errorMessage}\n\nPrediction ID: ${predictionId}`);
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
type SceneRequestPayload = {
  id: Id<"scenes">;
  sceneNumber?: number | null;
  imageUrl: string;
  description?: string | null;
  visualPrompt?: string | null;
  duration?: number | null;
  generateAudio?: boolean;
};

  const launchVideoPredictions = async (
    scenesPayload: SceneRequestPayload[],
    modelOverride?: string,
  ) => {
    if (!projectId || scenesPayload.length === 0 || !isAuthenticated) {
      return;
    }

    const modelToUse = getValidVideoModelId(
      modelOverride ?? selectedVideoModel,
    );
    const normalizedScenes = scenesPayload.map((scene) => ({
      ...scene,
      duration: sanitizeDurationForModel(modelToUse, scene.duration ?? null),
      generateAudio:
        scene.generateAudio && IMAGE_TO_VIDEO_MODELS.find(
          (model) => model.id === modelToUse,
        )?.supportsAudio
          ? true
          : false,
    }));

    console.log("[StoryboardPage] Launching video predictions", {
      model: modelToUse,
      scenes: normalizedScenes.map((scene) => ({
        id: scene.id,
        sceneNumber: scene.sceneNumber,
      })),
    });

    const response = await apiFetch("/api/generate-all-clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenes: normalizedScenes,
        videoModel: modelToUse,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      console.error("[StoryboardPage] generate-all-clips failed", errorBody);
      throw new Error(errorBody?.error || "Failed to generate video clips");
    }

    const result = await response.json();

    const clipRecords = await Promise.all(
      result.predictions.map(async (prediction: any) => {
        const sceneId = prediction.sceneId as Id<"scenes">;
        const sceneMeta = normalizedScenes.find(
          (scene) => scene.id === sceneId,
        );
        const existingClip =
          clips.find((clip) => clip.sceneId === sceneId) ?? null;

        if (existingClip) {
          await updateVideoClip({
            clipId: existingClip._id,
            status: "pending",
            videoUrl: "",
            errorMessage: "",
            replicateVideoId: prediction.predictionId,
          });
          return {
            clipId: existingClip._id,
            predictionId: prediction.predictionId,
            sceneId,
            duration: sceneMeta?.duration ?? prediction.duration,
          };
        }

        const clipId = await createVideoClip({
          sceneId,
          projectId: projectId as Id<"videoProjects">,
          duration: sceneMeta?.duration ?? prediction.duration,
          resolution: "720p",
          replicateVideoId: prediction.predictionId,
        });
        return {
          clipId,
          predictionId: prediction.predictionId,
          sceneId,
          duration: sceneMeta?.duration ?? prediction.duration,
        };
      }),
    );

    clipRecords.forEach(({ clipId, predictionId, sceneId }) => {
      if (predictionId) {
        startPolling(clipId, predictionId, sceneId);
      }
    });
  };

  const generateVideoClips = async () => {
    try {
      if (!isAuthenticated) {
        toast.error("Please sign in to generate videos.");
        return;
      }
      const safeModelId = getValidVideoModelId(selectedVideoModel);

      if (modelSelectionEnabled && safeModelId) {
        try {
          await updateProjectModelSelection({
            projectId: projectId as Id<"videoProjects">,
            stage: "video",
            modelId: safeModelId,
          });
        } catch (error) {
          console.error("Failed to record video model selection:", error);
        }
      }

      // Filter out scenes that already have complete clips
      const completedSceneIds = new Set(
        clips
          .filter((clip) => clip.status === "complete")
          .map((clip) => clip.sceneId),
      );

      // Only generate for scenes without complete clips
      const scenesToGenerate = convexScenes.filter(
        (scene) => !completedSceneIds.has(scene._id),
      );

      if (scenesToGenerate.length === 0) {
        return;
      }

      // Prepare scenes data for API
      const scenesData = scenesToGenerate.map((scene) => ({
        id: scene._id,
        sceneNumber: scene.sceneNumber,
        imageUrl: scene.imageUrl || "",
        description: scene.description,
        visualPrompt: scene.visualPrompt,
        duration: scene.duration,
        generateAudio: false,
      }));

      await launchVideoPredictions(scenesData, safeModelId);

      // Check completion status after initial generation starts
      setTimeout(() => checkAllClipsComplete(), 2000);
    } catch (error) {
      console.error("Error generating video clips:", error);
      hasStartedGeneration.current = false; // Allow retry
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!storyboardRows || !projectId || !isAuthenticated) return;

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
  }, [storyboardRows, projectId, syncShotToLegacyScene, isAuthenticated]);

  // Resume polling for clips that are still processing (on page load/refresh)
  useEffect(() => {
    if (!clips || clips.length === 0 || !isAuthenticated) return;

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
  }, [clips?.length, isAuthenticated]); // Only run when clips array length changes

  // Auto-update project status when all clips are complete
  useEffect(() => {
    if (!clips || !convexScenes || !projectId || !isAuthenticated) return;

    // Check if we have clips for all scenes
    const allScenesHaveClips = convexScenes.length > 0 &&
      convexScenes.every(scene =>
        clips.some(clip => clip.sceneId === scene._id)
      );

    if (!allScenesHaveClips) return;

    // Check if all clips are complete
    const allComplete = clips.every(clip => clip.status === "complete");

    // Update status if all complete and not already set
    if (allComplete && projectProgress?.projectStatus !== "video_generated") {
      updateProjectStatus({
        projectId,
        status: "video_generated",
      }).catch(error => console.error("Failed to update project status:", error));
    }
  }, [clips, convexScenes, projectId, projectProgress?.projectStatus, updateProjectStatus, isAuthenticated]);

  useEffect(() => {
    if (!selectedShotId) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-storyboard-selection-target='true']")) {
        return;
      }
      setSelectedShotId(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [selectedShotId]);

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
    <>
      <div className="min-h-screen bg-black text-white pb-32">
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
            audioLocked={projectProgress?.projectStatus !== "video_generated"}
            audioLockMessage="Generate video clips before soundtracking"
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
            <Button
              variant="outline"
              className="border-emerald-500/60 text-emerald-200 hover:bg-emerald-900/40"
              disabled={projectProgress?.projectStatus !== "video_generated"}
              onClick={() => router.push(`/${projectId}/audio`)}
              title={
                projectProgress?.projectStatus !== "video_generated"
                  ? "Finish video generation to build a soundtrack"
                  : "Move to soundtrack generation"
              }
            >
              Next: Audio
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
      {selectedShotDetails && (
        <div
          className="fixed bottom-[155px] left-0 right-0 z-40 px-4"
          data-storyboard-selection-target="true"
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-4 rounded-2xl border border-emerald-400/30 bg-black/85 p-4 shadow-lg shadow-emerald-500/10">
              <div className="w-full sm:w-40 h-28 rounded-xl border border-white/10 bg-gray-900 overflow-hidden">
                {selectedShotDetails.imageUrl ? (
                  <img
                    src={
                      proxiedImageUrl(selectedShotDetails.imageUrl) ??
                      selectedShotDetails.imageUrl
                    }
                    alt="Reference frame for selected video"
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                    Reference image unavailable
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs uppercase tracking-widest text-emerald-300">
                  Selected Video
                </p>
                <h3 className="text-lg font-semibold text-white">
                  Scene {selectedShotDetails.sceneNumber} · Shot{" "}
                  {selectedShotDetails.shotNumber}
                </h3>
                <p className="text-sm text-gray-400 line-clamp-2">
                  {selectedShotDetails.description}
                </p>
                <p className="text-xs text-gray-500">
                  Regenerations will use this reference frame for consistency.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div data-storyboard-selection-target="true">
        <ChatInput
          onSubmit={handleVideoChatSubmit}
          placeholder={
            selectedShotId
              ? "Describe how you want this video to evolve (or leave blank to rerun)."
              : "Select a shot to generate or regenerate its video..."
          }
          disabled={!selectedShotId || isGenerating || isSyncing}
          initialMessage={videoChatValue}
          onMessageChange={setVideoChatValue}
          shouldFocus={!!selectedShotId}
          selectedShotId={selectedShotId ?? undefined}
          initialMode="video"
        allowEmptySubmit
        initialModel={selectedVideoModel}
        onModelChange={(modelId) => setImageToVideoModel(modelId)}
          highlighted={!!selectedShotId}
        />
      </div>
    </>
  );
};

export default StoryboardPage;
