import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const useProjectData = (projectId: Id<"videoProjects"> | null) => {
  const data = useQuery(
    api.video.getProjectWithAllData,
    projectId ? { projectId } : "skip",
  );

  const currentPhase = useQuery(
    api.video.determineCurrentPhase,
    projectId ? { projectId } : "skip",
  );

  return {
    project: data?.project ?? null,
    questions: data?.questions ?? null,
    scenes: data?.scenes ?? [],
    clips: data?.clips ?? [],
    currentPhase: currentPhase ?? null,
    isLoading: data === undefined || currentPhase === undefined,
  };
};
