"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhaseGuard } from "../_components/PhaseGuard";
import { useProjectData } from "../_components/useProjectData";
import { VideoGeneratingPhase } from "@/components/VideoGeneratingPhase";
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
  const updateProjectStatus = useMutation(api.video.updateProjectStatus);
  const [isReadyForEditor, setIsReadyForEditor] = useState(false);
  const [completedClipsState, setCompletedClipsState] = useState<any[]>([]);

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
          lipsyncVideoUrl:
            status === "complete" && videoUrl ? videoUrl : undefined,
          hasLipsync,
          status,
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
      console.warn("[VideoPage] Skipping poll", {
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
        console.log("[VideoPage] Poll tick", {
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
            proxyUrl: result.proxyUrl ?? undefined,
            r2Key: result.r2Key ?? undefined,
            sourceUrl: result.sourceUrl ?? undefined,
          });
          activeVideoPolls.current.delete(clipId);
          console.log("[VideoPage] Clip complete", {
            clipId,
            predictionId,
            videoUrl: result.videoUrl,
          });
          await queueLipsyncForClip(sceneId, clipId, result.videoUrl);
          return;
        }

        if (result.status === "failed") {
          await updateVideoClip({
            clipId,
            status: "failed",
          });
          activeVideoPolls.current.delete(clipId);
          console.error("[VideoPage] Clip failed while polling", {
            clipId,
            predictionId,
            error: result.errorMessage,
          });
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
        console.error("Error polling prediction:", error, {
          clipId,
          predictionId,
          attempts,
        });
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          activeVideoPolls.current.delete(clipId);
          console.error("[VideoPage] Poll aborted after max attempts", {
            clipId,
            predictionId,
          });
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
      console.log("[VideoPage] Auto-starting video generation", {
        projectId,
        sceneCount: convexScenes.length,
        selectedVideoModel,
      });
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
      console.log("[VideoPage] Prepared scenes payload", scenesData);

      // Call API to create Replicate predictions
      console.log("[VideoPage] Calling /api/generate-all-clips", {
        videoModel: selectedVideoModel,
      });
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
        console.error("[VideoPage] generate-all-clips failed", errorBody);
        throw new Error(
          errorBody?.error || "Failed to generate video clips",
        );
      }

      const result = await response.json();
      console.log("[VideoPage] generate-all-clips response", result);

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
          console.log("[VideoPage] Created clip record", {
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
      console.log("[VideoPage] Clip predictions queued");
    } catch (error) {
      console.error("Error generating video clips:", error);
      setIsGenerating(false);
      hasStartedGeneration.current = false; // Allow retry
    }
  };

  const handleVideoGenerationComplete = async (completedClips: any[]) => {
    try {
      await updateProjectStatus({
        projectId: projectId as Id<"videoProjects">,
        status: "video_generated",
      });
      setCompletedClipsState(completedClips);
      setIsReadyForEditor(true);
    } catch (error) {
      console.error("Error updating phase:", error);
    }
  };

  const handleNavigateToEditor = async () => {
    try {
      await updateLastActivePhase({
        projectId: projectId as Id<"videoProjects">,
        phase: "editor",
      });
    } catch (error) {
      console.error("Failed to update last active phase:", error);
    }
    router.push(`/${projectId}/editor`);
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

  if (convexScenes.length === 0) {
    console.warn("[VideoPage] No legacy scenes found. Ensure storyboard selections are synced.");
    return (
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto text-center bg-muted/30 border border-muted rounded-3xl p-10 space-y-4">
          <h1 className="text-2xl font-semibold">No clips to generate yet</h1>
          <p className="text-muted-foreground">
            Select master shots for each scene in the Storyboard page (all shots must have a chosen
            image). Once selections are saved, return here to generate video clips.
          </p>
          <button
            className="px-6 py-3 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
            onClick={() => router.push(`/${projectId}/storyboard`)}
          >
            Back to Storyboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PhaseGuard requiredPhase="video" disableRedirect allowWhenLocked>
        <VideoGeneratingPhase
          scenes={scenesForComponent}
          projectId={projectId as Id<"videoProjects">}
          onComplete={handleVideoGenerationComplete}
          enableLipsync={enableLipsync}
          onToggleLipsync={setEnableLipsync}
        />
      </PhaseGuard>

      <div className="border border-muted rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-muted/20">
        <div>
          <p className="text-sm font-semibold">
            {isReadyForEditor
              ? "Video clips are ready. Review them before moving on."
              : "Waiting for clip generation to finish…"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isReadyForEditor
              ? `Generated clips: ${completedClipsState.length}`
              : "You'll be able to continue once every clip finishes processing."}
          </p>
        </div>
        <button
          disabled={!isReadyForEditor}
          onClick={handleNavigateToEditor}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
            isReadyForEditor
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {isReadyForEditor ? "Next: Open Editor" : "Generating clips…"}
        </button>
      </div>
    </div>
  );
};

export default VideoPage;