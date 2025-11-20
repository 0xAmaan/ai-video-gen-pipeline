"use client";

import { useEffect, useState } from "react";
import { InputPhaseWrapper } from "@/components/InputPhaseWrapper";
import { StoryboardPhase } from "@/components/StoryboardPhase";
import { GeneratingPhase } from "@/components/GeneratingPhase";
import { StoryboardGeneratingPhase } from "@/components/StoryboardGeneratingPhase";
import { VideoGeneratingPhase } from "@/components/VideoGeneratingPhase";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Phase = "input" | "generating_storyboard" | "storyboard" | "generating_video" | "editor";

interface VideoProject {
  prompt: string;
  responses: Record<string, string>;
  scenes: Scene[];
  videoUrl?: string;
  clips?: any[];
}

interface Scene {
  id: string;
  image: string;
  description: string;
  duration: number;
  order: number;
}

const CreateVideoPage = () => {
  const [currentPhase, setCurrentPhase] = useState<Phase>("input");
  const [project, setProject] = useState<VideoProject | null>(null);
  const [projectId, setProjectId] = useState<Id<"videoProjects"> | null>(null);
  const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);
  const [storyboardStatus, setStoryboardStatus] = useState<{
    stage: "generating_descriptions" | "generating_images" | "complete";
    currentScene: number;
  }>({ stage: "generating_descriptions", currentScene: 0 });

  const router = useRouter();
  const saveAnswers = useMutation(api.video.saveAnswers);
  const saveScenes = useMutation(api.video.saveScenes);
  const updateProjectStatus = useMutation(api.video.updateProjectStatus);
  const createVideoClip = useMutation(api.video.createVideoClip);
  const updateVideoClip = useMutation(api.video.updateVideoClip);

  useEffect(() => {
    if (currentPhase === "editor") {
      router.push("/editor");
    }
  }, [currentPhase, router]);

  const handleInputComplete = async (data: {
    prompt: string;
    responses: Record<string, string>;
    projectId: Id<"videoProjects">;
  }) => {
    try {
      // Save project ID and answers to Convex
      setProjectId(data.projectId);
      await saveAnswers({
        projectId: data.projectId,
        prompt: data.prompt,
        responses: data.responses,
      });

      // Update status to generating_storyboard (wrapped in try-catch to handle auth issues)
      try {
        await updateProjectStatus({
          projectId: data.projectId,
          status: "generating_storyboard",
        });
      } catch (statusError) {
        console.warn("Failed to update project status:", statusError);
        // Continue anyway - status update is not critical
      }

      // Set project data and move to generating storyboard phase
      setProject({
        prompt: data.prompt,
        responses: data.responses,
        scenes: [],
      });
      setCurrentPhase("generating_storyboard");
      setStoryboardStatus({
        stage: "generating_descriptions",
        currentScene: 0,
      });

      // Call the storyboard generation API
      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: data.prompt,
          responses: data.responses,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error:", errorData);
        throw new Error(errorData.details || "Failed to generate storyboard");
      }

      const result = await response.json();

      // Convert API response to Scene format
      const scenes: Scene[] = result.scenes.map((scene: any, index: number) => ({
        id: `scene-${scene.sceneNumber}`,
        image: scene.imageUrl || "",
        description: scene.description,
        duration: scene.duration,
        order: index,
      }));

      // Save scenes to Convex
      await saveScenes({
        projectId: data.projectId,
        scenes: result.scenes,
      });

      setGeneratedScenes(scenes);
      setProject({
        prompt: data.prompt,
        responses: data.responses,
        scenes: scenes,
      });
      setStoryboardStatus({ stage: "complete", currentScene: scenes.length });

      // Move to storyboard phase after a brief delay
      setTimeout(() => {
        setCurrentPhase("storyboard");
      }, 1000);
    } catch (error) {
      console.error("Error generating storyboard:", error);
      // Fallback to empty storyboard
      setProject({
        prompt: data.prompt,
        responses: data.responses,
        scenes: [],
      });
      setCurrentPhase("storyboard");
    }
  };

  const handleGenerateVideo = async (scenes: Scene[]) => {
    if (!projectId) {
      console.error("No project ID available");
      return;
    }

    try {
      setProject((prev) => (prev ? { ...prev, scenes } : null));
      setCurrentPhase("generating_video");

      // Update project status
      await updateProjectStatus({
        projectId,
        status: "video_generated",
      });

      // Call the parallel video generation API to create predictions
      const scenesData = scenes.map((scene, index) => ({
        id: scene.id,
        sceneNumber: scene.order + 1, // Convert 0-indexed order to 1-indexed sceneNumber
        imageUrl: scene.image,
        description: scene.description,
        duration: scene.duration,
      }));

      const response = await fetch("/api/generate-all-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes: scenesData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Video generation API error:", errorData);
        throw new Error(errorData.details || "Failed to create predictions");
      }

      const result = await response.json();
      console.log("Predictions created:", result);

      // Create video clip records in Convex with prediction IDs
      const clipRecords = await Promise.all(
        result.predictions.map(async (prediction: any) => {
          // Only include replicateVideoId if it's not null
          const clipArgs: any = {
            sceneId: prediction.sceneId as Id<"scenes">,
            projectId,
            duration: prediction.duration,
            resolution: "720p",
          };

          if (prediction.predictionId) {
            clipArgs.replicateVideoId = prediction.predictionId;
          }

          const clipId = await createVideoClip(clipArgs);
          return {
            clipId,
            sceneId: prediction.sceneId,
            predictionId: prediction.predictionId,
            sceneNumber: prediction.sceneNumber
          };
        })
      );

      // Start polling for each prediction
      clipRecords.forEach((record) => {
        if (record.predictionId) {
          pollPrediction(record.clipId, record.predictionId);
        } else {
          // Mark as failed if no prediction ID
          updateVideoClip({
            clipId: record.clipId,
            status: "failed",
            errorMessage: "Failed to create prediction",
          });
        }
      });
    } catch (error) {
      console.error("Error generating video clips:", error);
    }
  };

  // Poll a single prediction until complete
  const pollPrediction = async (clipId: Id<"videoClips">, predictionId: string) => {
    const pollInterval = 5000; // Poll every 5 seconds
    const maxAttempts = 180; // 15 minutes max (180 * 5s)
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;

        const response = await fetch("/api/poll-prediction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ predictionId }),
        });

        if (!response.ok) {
          throw new Error("Failed to poll prediction");
        }

        const result = await response.json();

        if (result.status === "complete") {
          // Update Convex with completed video
          await updateVideoClip({
            clipId,
            status: "complete",
            videoUrl: result.proxyUrl ?? result.videoUrl,
            proxyUrl: result.proxyUrl ?? undefined,
            r2Key: result.r2Key ?? undefined,
            sourceUrl: result.sourceUrl ?? result.videoUrl,
          });
          console.log(`Clip ${clipId} completed: ${result.videoUrl}`);
        } else if (result.status === "failed") {
          // Update Convex with failure
          await updateVideoClip({
            clipId,
            status: "failed",
            errorMessage: result.errorMessage,
          });
          console.error(`Clip ${clipId} failed: ${result.errorMessage}`);
        } else if (result.status === "processing") {
          // Update to processing status if not already
          await updateVideoClip({
            clipId,
            status: "processing",
          });

          // Continue polling if under max attempts
          if (attempts < maxAttempts) {
            setTimeout(poll, pollInterval);
          } else {
            await updateVideoClip({
              clipId,
              status: "failed",
              errorMessage: "Prediction timed out after 15 minutes",
            });
          }
        }
      } catch (error) {
        console.error(`Error polling prediction ${predictionId}:`, error);

        // Retry if under max attempts
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          await updateVideoClip({
            clipId,
            status: "failed",
            errorMessage: "Failed to poll prediction status",
          });
        }
      }
    };

    // Start polling
    poll();
  };

  const handleVideoGenerationComplete = (clips: any[]) => {
    console.log("All clips generated:", clips);

    // Pass real clips to editor
    setProject((prev) =>
      prev ? { ...prev, videoUrl: "placeholder", clips: clips } : null,
    );
    setCurrentPhase("editor");
  };


  return (
    <div className="min-h-screen bg-background-base">
      {/* Phase Indicator */}
      <PhaseIndicator
        currentPhase={currentPhase}
        onPhaseClick={setCurrentPhase}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {currentPhase === "input" && (
          <InputPhaseWrapper onComplete={handleInputComplete} />
        )}

        {currentPhase === "generating_storyboard" && (
          <StoryboardGeneratingPhase
            scenes={generatedScenes}
            totalScenes={5}
            currentStage={storyboardStatus.stage}
            currentSceneNumber={storyboardStatus.currentScene}
          />
        )}

        {currentPhase === "storyboard" && project && (
          <StoryboardPhase
            prompt={project.prompt}
            scenes={project.scenes}
            onGenerateVideo={handleGenerateVideo}
            projectId={projectId}
          />
        )}

        {currentPhase === "generating_video" && project && projectId && (
          <VideoGeneratingPhase
            scenes={project.scenes}
            projectId={projectId}
            onComplete={handleVideoGenerationComplete}
          />
        )}

        {currentPhase === "editor" && (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Redirecting you to the editor…
          </div>
        )}
      </div>
    </div>
  );
};

interface PhaseIndicatorProps {
  currentPhase: Phase;
  onPhaseClick: (phase: Phase) => void;
}

const PhaseIndicator = ({
  currentPhase,
  onPhaseClick,
}: PhaseIndicatorProps) => {
  const phases: { id: Phase; label: string }[] = [
    { id: "input", label: "Input" },
    { id: "generating_storyboard", label: "Generating" },
    { id: "storyboard", label: "Storyboard" },
    { id: "generating_video", label: "Video" },
    { id: "editor", label: "Edit" },
  ];

  const currentIndex = phases.findIndex((p) => p.id === currentPhase);

  return (
    <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-5">
        <div className="flex items-center justify-center gap-2">
          {phases.map((phase, index) => (
            <div key={phase.id} className="flex items-center">
              <button
                onClick={() => onPhaseClick(phase.id)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                    index < currentIndex
                      ? "bg-primary border-primary text-primary-foreground"
                      : index === currentIndex
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {index < currentIndex ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    index === currentIndex
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {phase.label}
                </span>
              </button>
              {index < phases.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    index < currentIndex ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreateVideoPage;
