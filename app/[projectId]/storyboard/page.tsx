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

type StoryboardStage =
  | "parsing_prompt"
  | "planning_scenes"
  | "selecting_voice"
  | "generating_images"
  | "generating_narrations"
  | "finalizing"
  | "complete";

const StoryboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;

  const {
    project,
    questions,
    scenes: convexScenes,
  } = useProjectData(projectId as Id<"videoProjects">);

  const [isGenerating, setIsGenerating] = useState(false);
  const [storyboardStatus, setStoryboardStatus] = useState<{
    stage: StoryboardStage;
    currentScene: number;
  }>({ stage: "parsing_prompt", currentScene: 0 });
  const [modelInfo, setModelInfo] = useState<{
    modelName: string;
    estimatedCost: number;
    reason: string;
  }>({
    modelName: "Selecting optimal model...",
    estimatedCost: 0,
    reason: "Analyzing your preferences to choose the best image model",
  });
  const [generatingScenes, setGeneratingScenes] = useState<any[]>([]);

  const saveScenes = useMutation(api.video.saveScenes);
  const updateProjectStatus = useMutation(api.video.updateProjectStatus);
  const updateLastActivePhase = useMutation(api.video.updateLastActivePhase);

  // Check if we need to generate storyboard
  useEffect(() => {
    if (
      project &&
      questions?.answers &&
      convexScenes.length === 0 &&
      !isGenerating
    ) {
      // Need to generate storyboard
      setIsGenerating(true);
      generateStoryboard();
    }
  }, [project, questions, convexScenes]);

  const generateStoryboard = async () => {
    if (!project || !questions?.answers) return;

    try {
      // Step 1: Start pipeline
      setStoryboardStatus({
        stage: "parsing_prompt",
        currentScene: 0,
      });

      // Update project status
      await updateProjectStatus({
        projectId: projectId as Id<"videoProjects">,
        status: "generating_storyboard",
      });

      // Simulate model selection happening (2 seconds)
      setTimeout(() => {
        // This will show the model info card immediately
        // (will be updated with real data when API returns)
        setStoryboardStatus({
          stage: "planning_scenes",
          currentScene: 0,
        });
      }, 500);

      // Call the storyboard generation API
      const apiStartTime = Date.now();

      // TEMPORARY: Get character reference from localStorage
      const characterData = localStorage.getItem(`character-${projectId}`);
      const characterReference = characterData
        ? JSON.parse(characterData).referenceImageUrl
        : undefined;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (characterReference) {
        headers["x-character-reference"] = characterReference;
      }

      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers,
        body: JSON.stringify({
          projectId: projectId,
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

      // Update model info immediately when we get the response
      if (result.modelInfo) {
        console.log("✅ Model info received from API:", result.modelInfo);
        setModelInfo({
          modelName: result.modelInfo.modelName,
          estimatedCost: result.modelInfo.estimatedCost,
          reason: result.modelInfo.reason,
        });
        console.log(
          "✅ UI updated with actual model:",
          result.modelInfo.modelName,
        );
      }

      // Selecting voice completed server-side
      setStoryboardStatus({
        stage: "selecting_voice",
        currentScene: 0,
      });

      // Switch to generating images stage
      setStoryboardStatus({
        stage: "generating_images",
        currentScene: 1,
      });

      // Simulate progressive image generation with visual feedback
      const totalScenes = result.scenes.length;
      setGeneratingScenes([]); // Clear previous scenes

      for (let i = 0; i < result.scenes.length; i++) {
        // Update progress for each scene
        setStoryboardStatus({
          stage: "generating_images",
          currentScene: i + 1,
        });

        // Add scene to our local array for immediate UI update
        setGeneratingScenes((prev) => [...prev, result.scenes[i]]);

        // Wait a bit between scenes for visual feedback (except last one)
        if (i < result.scenes.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }

      setStoryboardStatus({
        stage: "generating_narrations",
        currentScene: result.scenes.length,
      });

      // Save all scenes to Convex (including visualPrompt for video generation)
      await saveScenes({
        projectId: projectId as Id<"videoProjects">,
        scenes: result.scenes,
      });

      setStoryboardStatus({
        stage: "finalizing",
        currentScene: result.scenes.length,
      });

      setStoryboardStatus({
        stage: "complete",
        currentScene: result.scenes.length,
      });
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

  // Convert scenes to component format
  const scenesForComponent: Scene[] = isGenerating
    ? generatingScenes.map((scene, index) => ({
        id: `temp-${index}`,
        image: scene.imageUrl || "",
        description: scene.description,
        visualPrompt: scene.visualPrompt,
        duration: scene.duration,
        sceneNumber: scene.sceneNumber,
        narrationUrl: scene.narrationUrl,
        narrationText: scene.narrationText,
        voiceId: scene.voiceId,
        voiceName: scene.voiceName,
      }))
    : convexScenes.map((scene) => ({
        id: scene._id,
        image: scene.imageUrl || "",
        description: scene.description,
        visualPrompt: scene.visualPrompt,
        duration: scene.duration,
        sceneNumber: scene.sceneNumber,
        narrationUrl: scene.narrationUrl || undefined,
        narrationText: scene.narrationText || undefined,
        voiceId: scene.voiceId || undefined,
        voiceName: scene.voiceName || undefined,
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
          project={project}
        />
      )}
    </PhaseGuard>
  );
};

export default StoryboardPage;
