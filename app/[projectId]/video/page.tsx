"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhaseGuard } from "../_components/PhaseGuard";
import { useProjectData } from "../_components/useProjectData";
import { VideoGeneratingPhase } from "@/components/VideoGeneratingPhase";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Scene } from "@/types/scene";

const VideoPage = () => {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;

  const { scenes: convexScenes, clips } = useProjectData(
    projectId as Id<"videoProjects">,
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const hasStartedGeneration = useRef(false);

  const updateLastActivePhase = useMutation(api.video.updateLastActivePhase);
  const createVideoClip = useMutation(api.video.createVideoClip);
  const updateVideoClip = useMutation(api.video.updateVideoClip);

  // Polling function to check Replicate prediction status
  const startPolling = (clipId: Id<"videoClips">, predictionId: string) => {
    const pollInterval = 5000; // 5 seconds
    const maxAttempts = 180; // 15 minutes max (180 * 5s)
    let attempts = 0;

    const poll = async () => {
      attempts++;

      try {
        const response = await fetch("/api/poll-prediction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ predictionId }),
        });

        const result = await response.json();

        if (result.status === "complete") {
          // Update Convex with completed video
          await updateVideoClip({
            clipId,
            status: "complete",
            videoUrl: result.videoUrl,
          });
        } else if (result.status === "failed") {
          await updateVideoClip({
            clipId,
            status: "failed",
          });
        } else if (
          result.status === "processing" ||
          result.status === "starting"
        ) {
          // Update to processing and continue polling
          await updateVideoClip({
            clipId,
            status: "processing",
          });

          if (attempts < maxAttempts) {
            setTimeout(poll, pollInterval); // Poll again in 5 seconds
          }
        }
      } catch (error) {
        console.error("Error polling prediction:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval); // Retry on error
        }
      }
    };

    poll(); // Start polling immediately
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
      console.log(`Resuming polling for ${processingClips.length} clips...`);
      processingClips.forEach((clip) => {
        if (clip.replicateVideoId) {
          startPolling(clip._id, clip.replicateVideoId);
        }
      });
    }
  }, [clips?.length]); // Only run when clips array length changes

  const generateVideoClips = async () => {
    try {
      console.log(
        "Starting video clip generation for",
        convexScenes.length,
        "scenes",
      );

      // Prepare scenes data for API
      const scenesData = convexScenes.map((scene, index) => ({
        id: scene._id,
        sceneNumber: scene.sceneNumber,
        imageUrl: scene.imageUrl || "",
        description: scene.description,
        duration: scene.duration,
      }));

      // Call API to create Replicate predictions
      const response = await fetch("/api/generate-all-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes: scenesData }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate video clips");
      }

      const result = await response.json();
      console.log("Replicate predictions created:", result.predictions);

      // Create video clip records in Convex with prediction IDs
      const clipRecords = await Promise.all(
        result.predictions.map(async (prediction: any) => {
          const clipId = await createVideoClip({
            sceneId: prediction.sceneId as Id<"scenes">,
            projectId: projectId as Id<"videoProjects">,
            duration: prediction.duration,
            resolution: "720p",
            replicateVideoId: prediction.predictionId,
          });
          return { clipId, predictionId: prediction.predictionId };
        }),
      );

      console.log("Created clip records:", clipRecords);

      // Start polling each prediction
      clipRecords.forEach(({ clipId, predictionId }) => {
        if (predictionId) {
          startPolling(clipId, predictionId);
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
      console.log("All clips generated:", completedClips);

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
  }));

  return (
    <PhaseGuard requiredPhase="video">
      <VideoGeneratingPhase
        scenes={scenesForComponent}
        projectId={projectId as Id<"videoProjects">}
        onComplete={handleVideoGenerationComplete}
      />
    </PhaseGuard>
  );
};

export default VideoPage;
