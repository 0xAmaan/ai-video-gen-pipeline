"use client";

import { useState, useCallback } from "react";
import { InputPhase } from "./InputPhase";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface InputPhaseWrapperProps {
  onComplete: (data: {
    prompt: string;
    responses: Record<string, string>;
    projectId: Id<"videoProjects">;
  }) => void;
  existingProjectId?: Id<"videoProjects">;
}

export const InputPhaseWrapper = ({ onComplete, existingProjectId }: InputPhaseWrapperProps) => {
  const [projectId, setProjectId] = useState<Id<"videoProjects"> | null>(existingProjectId || null);
  const createProject = useMutation(api.video.createProject);
  const saveQuestions = useMutation(api.video.saveQuestions);

  // Create project and save questions when they're generated
  const handleQuestionsGenerated = useCallback(
    async (prompt: string, questions: any[]) => {
      try {
        // Use existing project ID or create a new one
        const useProjectId = existingProjectId || projectId;

        if (!useProjectId) {
          const newProjectId = await createProject({ prompt });
          setProjectId(newProjectId);

          // Save the generated questions
          await saveQuestions({
            projectId: newProjectId,
            questions,
          });

          return newProjectId;
        }

        // If project already exists, just save the questions
        await saveQuestions({
          projectId: useProjectId,
          questions,
        });

        return useProjectId;
      } catch (error) {
        console.error("Error creating project or saving questions:", error);
        return null;
      }
    },
    [projectId, existingProjectId, createProject, saveQuestions]
  );

  const handleComplete = (data: {
    prompt: string;
    responses: Record<string, string>;
    projectId?: string;
  }) => {
    const useProjectId = existingProjectId || projectId;
    if (useProjectId) {
      onComplete({
        prompt: data.prompt,
        responses: data.responses,
        projectId: useProjectId,
      });
    }
  };

  return (
    <InputPhase
      onComplete={handleComplete}
      projectId={(existingProjectId || projectId) as string | undefined}
      onQuestionsGenerated={handleQuestionsGenerated}
    />
  );
};
