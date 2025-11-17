"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhaseGuard } from "../_components/PhaseGuard";
import { useProjectData } from "../_components/useProjectData";
import { InputPhase } from "@/components/InputPhase";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { apiFetchJSON } from "@/lib/api-fetch";

const PromptPage = () => {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;

  const { project, questions, isLoading } = useProjectData(
    projectId as Id<"videoProjects">,
  );

  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [hasGeneratedQuestions, setHasGeneratedQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveQuestions = useMutation(api.video.saveQuestions);
  const saveAnswers = useMutation(api.video.saveAnswers);
  const updateLastActivePhase = useMutation(api.video.updateLastActivePhase);
  const updateProjectStatus = useMutation(api.video.updateProjectStatus);

  // Generate questions if they don't exist yet
  useEffect(() => {
    if (
      !isLoading &&
      project &&
      !questions &&
      !isGeneratingQuestions &&
      !hasGeneratedQuestions
    ) {
      generateQuestions();
    }
  }, [
    isLoading,
    project,
    questions,
    isGeneratingQuestions,
    hasGeneratedQuestions,
  ]);

  const generateQuestions = async () => {
    if (!project) return;

    try {
      setIsGeneratingQuestions(true);

      // Call API - automatically handles demo mode headers and flow event import
      const data = await apiFetchJSON("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: project.prompt }),
      });

      // Save questions to Convex
      await saveQuestions({
        projectId: projectId as Id<"videoProjects">,
        questions: data.questions,
      });

      setHasGeneratedQuestions(true);
      setError(null);
    } catch (error) {
      console.error("Error generating questions:", error);
      setError("Failed to generate questions. Please try again.");
      setHasGeneratedQuestions(false);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const retryGenerateQuestions = () => {
    setError(null);
    setHasGeneratedQuestions(false);
    generateQuestions();
  };

  const handleInputComplete = async (data: {
    prompt: string;
    responses: Record<string, string>;
    projectId?: string;
  }) => {
    try {
      // Save answers to Convex
      await saveAnswers({
        projectId: projectId as Id<"videoProjects">,
        prompt: data.prompt,
        responses: data.responses,
      });

      // Update last active phase to character-select (before storyboard)
      await updateLastActivePhase({
        projectId: projectId as Id<"videoProjects">,
        phase: "storyboard", // Keep storyboard as the phase for now
      });

      // Navigate to character selection
      router.push(`/${projectId}/character-select`);
    } catch (error) {
      console.error("Error saving answers:", error);
    }
  };

  if (error) {
    return (
      <PhaseGuard requiredPhase="prompt">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-destructive text-4xl">⚠️</div>
            <h2 className="text-xl font-semibold">
              Error Generating Questions
            </h2>
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={retryGenerateQuestions}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </PhaseGuard>
    );
  }

  if (isLoading || isGeneratingQuestions) {
    return (
      <PhaseGuard requiredPhase="prompt">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">
              {isGeneratingQuestions ? "Generating questions..." : "Loading..."}
            </p>
          </div>
        </div>
      </PhaseGuard>
    );
  }

  return (
    <PhaseGuard requiredPhase="prompt">
      <InputPhase
        onComplete={handleInputComplete}
        projectId={projectId}
        initialPrompt={project?.prompt}
        initialQuestions={questions?.questions}
        // Don't need onQuestionsGenerated since questions are already generated
        onQuestionsGenerated={async () => projectId}
      />
    </PhaseGuard>
  );
};

export default PromptPage;
