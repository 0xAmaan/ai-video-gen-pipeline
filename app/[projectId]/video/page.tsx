"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhaseGuard } from "../_components/PhaseGuard";
import { useProjectData } from "../_components/useProjectData";
import { VideoGeneratingPhase } from "@/components/VideoGeneratingPhase";
import { ModelSelector } from "@/components/ui/model-selector";
import { useImageToVideoModel, useModelSelectionEnabled } from "@/lib/stores/modelStore";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Scene } from "@/types/scene";
import { apiFetch } from "@/lib/api-fetch";

const VideoPage = () => {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;
  const selectedVideoModel = useImageToVideoModel();
  const modelSelectionEnabled = useModelSelectionEnabled();

  const { project, scenes: convexScenes, clips } = useProjectData(
    projectId as Id<"videoProjects">,
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [enableLipsync, setEnableLipsync] = useState(true);
  const [isResettingVideoModel, setIsResettingVideoModel] = useState(false);
  const hasStartedGeneration = useRef(false);
  const enableLipsyncRef = useRef(enableLipsync);
  const scenesRef = useRef(convexScenes);
  const activeVideoPolls = useRef(new Set<string>());
  const activeLipsyncPolls = useRef(new Set<string>());
  const queuedLipsyncScenes = useRef(new Set<string>());

  const updateLastActivePhase = useMutation(api.video.updateLastActivePhase);
  const createVideoClip = useMutation(api.video.createVideoClip);
  const updateVideoClip = useMutation(api.video.updateVideoClip);
  const updateSceneLipsync = useMutation(api.video.updateSceneLipsync);
  const updateVideoClipLipsync = useMutation(
    api.video.updateVideoClipLipsync,
  );
  const updateProjectModelSelection = useMutation(
    api.video.updateProjectModelSelection,
  );
  const resetPhaseMutation = useMutation(api.video.resetProjectPhase);

  useEffect(() => {
    enableLipsyncRef.current = enableLipsync;
  }, [enableLipsync]);

  useEffect(() => {
    scenesRef.current = convexScenes;
  }, [convexScenes]);

  const shouldResetVideoPhase =
    Boolean(projectId) &&
    modelSelectionEnabled &&
    Boolean(selectedVideoModel) &&
    Boolean(project?.videoModelId) &&
    project?.videoModelId !== selectedVideoModel &&
    clips.length > 0;

  useEffect(() => {
    if (!shouldResetVideoPhase || isResettingVideoModel) {
      return;
    }

    let cancelled = false;

    const resetVideoPhase = async () => {
      try {
        setIsResettingVideoModel(true);
        activeVideoPolls.current.clear();
        activeLipsyncPolls.current.clear();
        queuedLipsyncScenes.current.clear();
        hasStartedGeneration.current = false;
        await resetPhaseMutation({
          projectId: projectId as Id<"videoProjects">,
          stage: "video",
        });
        setIsGenerating(false);
      } catch (error) {
        console.error("Failed to reset video phase:", error);
      } finally {
        if (!cancelled) {
          setIsResettingVideoModel(false);
        }
      }
    };

    resetVideoPhase();

    return () => {
      cancelled = true;
    };
  }, [
    shouldResetVideoPhase,
    isResettingVideoModel,
    resetPhaseMutation,
    projectId,
  ]);

  const applyLocalLipsyncResult = async ({
    sceneId,
    clipId,
    videoUrl,
    status,
    hasLipsync = false,
  }: {
    sceneId: Id<"scenes">;
    clipId?: Id<"videoClips">;
    videoUrl?: string | null;
    status: "complete" | "failed";
    hasLipsync?: boolean;
  }) => {
    try {
      await updateSceneLipsync({
        sceneId,
        lipsyncStatus: status,
        lipsyncVideoUrl:
          status === "complete" && videoUrl ? videoUrl : undefined,
      });
    } catch (error) {
      console.error("Failed to update scene lip sync metadata:", error);
    }

    if (clipId) {
      try {
        await updateVideoClipLipsync({
          clipId,
          originalVideoUrl: videoUrl ?? undefined,
          lipsyncVideoUrl:
            status === "complete" && videoUrl ? videoUrl : undefined,
          hasLipsync,
        });
      } catch (error) {
        console.error("Failed to update clip lip sync metadata:", error);
      }
    }
  };

  const startLipsyncPolling = (
    predictionId: string,
    sceneId: Id<"scenes">,
    clipId?: Id<"videoClips">,
  ) => {
    if (!predictionId || activeLipsyncPolls.current.has(predictionId)) {
      return;
    }

    activeLipsyncPolls.current.add(predictionId);
    const pollInterval = 7000;
    const maxAttempts = 240;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;

      try {
        const response = await apiFetch("/api/poll-lipsync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            predictionId,
            sceneId,
            clipId,
          }),
        });

        const result = await response.json();

        if (result.lipsyncStatus === "complete") {
          activeLipsyncPolls.current.delete(predictionId);
          return;
        }

        if (result.lipsyncStatus === "failed") {
          activeLipsyncPolls.current.delete(predictionId);
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          activeLipsyncPolls.current.delete(predictionId);
          await applyLocalLipsyncResult({
            sceneId,
            clipId,
            videoUrl: result.lipsyncVideoUrl,
            status: "failed",
          });
        }
      } catch (error) {
        console.error("Error polling lip sync prediction:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          activeLipsyncPolls.current.delete(predictionId);
          await applyLocalLipsyncResult({
            sceneId,
            clipId,
            status: "failed",
          });
        }
      }
    };

    poll();
  };

  const queueLipsyncForClip = async (
    sceneId: Id<"scenes">,
    clipId: Id<"videoClips">,
    videoUrl?: string | null,
  ) => {
    if (!videoUrl) {
      await applyLocalLipsyncResult({
        sceneId,
        clipId,
        status: "failed",
      });
      return;
    }

    if (queuedLipsyncScenes.current.has(sceneId)) {
      return;
    }

    queuedLipsyncScenes.current.add(sceneId);

    const scenes = scenesRef.current;
    const scene = scenes.find((entry) => entry._id === sceneId);
    if (!scene) {
      await applyLocalLipsyncResult({
        sceneId,
        clipId,
        videoUrl,
        status: "failed",
      });
      return;
    }

    if (!enableLipsyncRef.current || !scene.narrationUrl) {
      await applyLocalLipsyncResult({
        sceneId,
        clipId,
        videoUrl,
        status: "complete",
        hasLipsync: false,
      });
      return;
    }

    try {
      const response = await apiFetch("/api/lipsync-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl,
          audioUrl: scene.narrationUrl,
          syncMode: "cut_off",
          temperature: 0.5,
          sceneId,
          clipId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lip sync request failed");
      }

      if (data.predictionId) {
        startLipsyncPolling(data.predictionId, sceneId, clipId);
      } else {
        throw new Error("Lip sync did not return a predictionId");
      }
    } catch (error) {
      console.error("Failed to queue lip sync:", error);
      await applyLocalLipsyncResult({
        sceneId,
        clipId,
        videoUrl,
        status: "failed",
      });
    }
  };

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
          await queueLipsyncForClip(sceneId, clipId, result.videoUrl);
          return;
        }

        if (result.status === "failed") {
          await updateVideoClip({
            clipId,
            status: "failed",
          });
          activeVideoPolls.current.delete(clipId);
          await applyLocalLipsyncResult({
            sceneId,
            clipId,
            status: "failed",
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
        console.error("Error polling prediction:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          activeVideoPolls.current.delete(clipId);
        }
      }
    };

    poll();
  };

  // Generate video clips when page loads
  useEffect(() => {
    const shouldGenerate =
      convexScenes.length > 0 &&
      clips?.length === 0 &&
      !isGenerating &&
      !hasStartedGeneration.current;

    if (shouldGenerate) {
      hasStartedGeneration.current = true;
      setIsGenerating(true);
      generateVideoClips();
    }
  }, [convexScenes, clips, isGenerating]);

  // Resume polling for clips that are still processing (on page load/refresh)
  useEffect(() => {
    if (!clips || clips.length === 0) return;

    const processingClips = clips.filter(
      (clip) => clip.status === "processing" || clip.status === "pending",
    );

    if (processingClips.length > 0) {
      processingClips.forEach((clip) => {
        if (clip.replicateVideoId) {
          startPolling(clip._id, clip.replicateVideoId, clip.sceneId);
        }
      });
    }
  }, [clips?.length]); // Only run when clips array length changes

  // Resume lip sync polling for scenes that are still processing
  useEffect(() => {
    if (!convexScenes || convexScenes.length === 0) return;

    convexScenes.forEach((scene) => {
      if (
        scene.lipsyncPredictionId &&
        scene.lipsyncStatus === "processing" &&
        !activeLipsyncPolls.current.has(scene.lipsyncPredictionId)
      ) {
        queuedLipsyncScenes.current.add(scene._id);
        const clipForScene = clips?.find((clip) => clip.sceneId === scene._id);
        startLipsyncPolling(
          scene.lipsyncPredictionId,
          scene._id as Id<"scenes">,
          clipForScene?._id as Id<"videoClips"> | undefined,
        );
      }
    });
  }, [convexScenes, clips]);

  const generateVideoClips = async () => {
    try {
      console.log(
        "Starting video clip generation for",
        convexScenes.length,
        "scenes",
      );

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
      const scenesData = convexScenes.map((scene, index) => ({
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
        throw new Error("Failed to generate video clips");
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
    } catch (error) {
      console.error("Error generating video clips:", error);
      setIsGenerating(false);
      hasStartedGeneration.current = false; // Allow retry
    }
  };

  const handleVideoGenerationComplete = async (completedClips: any[]) => {
    try {
      // Update last active phase to editor
      await updateLastActivePhase({
        projectId: projectId as Id<"videoProjects">,
        phase: "editor",
      });

      // Navigate to editor phase
      router.push(`/${projectId}/editor`);
    } catch (error) {
      console.error("Error updating phase:", error);
    }
  };

  // Convert Convex scenes to component format
  const scenesForComponent: Scene[] = convexScenes.map((scene) => ({
    id: scene._id,
    image: scene.imageUrl || "",
    description: scene.description,
    duration: scene.duration,
    sceneNumber: scene.sceneNumber,
    narrationUrl: scene.narrationUrl || undefined,
    narrationText: scene.narrationText || undefined,
    voiceId: scene.voiceId || undefined,
    voiceName: scene.voiceName || undefined,
    lipsyncVideoUrl: scene.lipsyncVideoUrl || undefined,
    lipsyncStatus: (scene.lipsyncStatus as Scene["lipsyncStatus"]) || undefined,
    lipsyncPredictionId: scene.lipsyncPredictionId || undefined,
  }));

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Model Selection */}
      {modelSelectionEnabled && (
        <ModelSelector
          step="image-to-video"
          title="Video Generation Model"
          description="Select the model for converting storyboard images to video clips"
        />
      )}

      <PhaseGuard requiredPhase="video">
        <VideoGeneratingPhase
          scenes={scenesForComponent}
          projectId={projectId as Id<"videoProjects">}
          onComplete={handleVideoGenerationComplete}
          enableLipsync={enableLipsync}
          onToggleLipsync={setEnableLipsync}
        />
      </PhaseGuard>
    </div>
  );
};

export default VideoPage;
