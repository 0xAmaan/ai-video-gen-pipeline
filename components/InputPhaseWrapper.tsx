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
}

export const InputPhaseWrapper = ({ onComplete }: InputPhaseWrapperProps) => {
  const [projectId, setProjectId] = useState<Id<"videoProjects"> | null>(null);
  const createProject = useMutation(api.video.createProject);
  const saveQuestions = useMutation(api.video.saveQuestions);

  // Create project and save questions when they're generated
  const handleQuestionsGenerated = useCallback(
    async (prompt: string, questions: any[]) => {
      try {
        // Create project if it doesn't exist
        if (!projectId) {
          const newProjectId = await createProject({ prompt });
          setProjectId(newProjectId);

          // Save the generated questions
          await saveQuestions({
            projectId: newProjectId,
            questions,
          });

          return newProjectId;
        }
        return projectId;
      } catch (error) {
        console.error("Error creating project or saving questions:", error);
        return null;
      }
    },
    [projectId, createProject, saveQuestions]
  );

  const handleComplete = (data: {
    prompt: string;
    responses: Record<string, string>;
    projectId?: string;
  }) => {
    if (projectId) {
      onComplete({
        prompt: data.prompt,
        responses: data.responses,
        projectId,
      });
    }
  };

  return (
    <InputPhase
      onComplete={handleComplete}
      projectId={projectId as string | undefined}
      onQuestionsGenerated={handleQuestionsGenerated}
    />
  );
};
