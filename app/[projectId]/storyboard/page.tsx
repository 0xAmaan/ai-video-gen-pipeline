"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhaseGuard } from "../_components/PhaseGuard";
import { useProjectData } from "../_components/useProjectData";
import { StoryboardPhase } from "@/components/StoryboardPhase";
import { StoryboardGeneratingPhase } from "@/components/StoryboardGeneratingPhase";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Scene } from "@/types/scene";

const StoryboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;

  const { project, questions, scenes: convexScenes } = useProjectData(
    projectId as Id<"videoProjects">,
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [storyboardStatus, setStoryboardStatus] = useState<{
    stage: "generating_descriptions" | "generating_images" | "complete";
    currentScene: number;
  }>({ stage: "generating_descriptions", currentScene: 0 });
  const [modelInfo, setModelInfo] = useState<{
    modelName: string;
    estimatedCost: number;
    reason: string;
  }>({
    modelName: "FLUX.1 Schnell",
    estimatedCost: 0.003,
    reason: "Default selection for fast, cost-effective generation",
  });

  const saveScenes = useMutation(api.video.saveScenes);
  const updateProjectStatus = useMutation(api.video.updateProjectStatus);
  const updateLastActivePhase = useMutation(api.video.updateLastActivePhase);

  // Check if we need to generate storyboard
  useEffect(() => {
    if (project && questions?.answers && convexScenes.length === 0 && !isGenerating) {
      // Need to generate storyboard
      setIsGenerating(true);
      generateStoryboard();
    }
  }, [project, questions, convexScenes]);

  const generateStoryboard = async () => {
    if (!project || !questions?.answers) return;

    try {
      setStoryboardStatus({
        stage: "generating_descriptions",
        currentScene: 0,
      });

      // Update project status
      await updateProjectStatus({
        projectId: projectId as Id<"videoProjects">,
        status: "generating_storyboard",
      });

      // Call the storyboard generation API
      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: questions.answers.prompt,
          responses: questions.answers.responses,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error:", errorData);
        throw new Error(errorData.details || "Failed to generate storyboard");
      }

      const result = await response.json();

      // Update model info if provided
      if (result.modelInfo) {
        setModelInfo({
          modelName: result.modelInfo.modelName,
          estimatedCost: result.modelInfo.estimatedCost,
          reason: result.modelInfo.reason,
        });
      }

      // Save scenes to Convex
      await saveScenes({
        projectId: projectId as Id<"videoProjects">,
        scenes: result.scenes,
      });

      setStoryboardStatus({ stage: "complete", currentScene: result.scenes.length });
      setIsGenerating(false);
    } catch (error) {
      console.error("Error generating storyboard:", error);
      setIsGenerating(false);
    }
  };

  const handleGenerateVideo = async (scenes: Scene[]) => {
    try {
      // Update last active phase to video
      await updateLastActivePhase({
        projectId: projectId as Id<"videoProjects">,
        phase: "video",
      });

      // Navigate to video phase
      router.push(`/${projectId}/video`);
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
    <PhaseGuard requiredPhase="storyboard">
      {isGenerating ? (
        <StoryboardGeneratingPhase
          scenes={scenesForComponent}
          totalScenes={5}
          currentStage={storyboardStatus.stage}
          currentSceneNumber={storyboardStatus.currentScene}
          modelName={modelInfo.modelName}
          estimatedCostPerImage={modelInfo.estimatedCost}
          modelReason={modelInfo.reason}
        />
      ) : (
        <StoryboardPhase
          prompt={questions?.answers?.prompt || project?.prompt || ""}
          scenes={scenesForComponent}
          onGenerateVideo={handleGenerateVideo}
          projectId={projectId as Id<"videoProjects">}
        />
      )}
    </PhaseGuard>
  );
};

export default StoryboardPage;
