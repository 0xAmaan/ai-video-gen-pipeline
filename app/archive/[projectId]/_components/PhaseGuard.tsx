"use client";

import { useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useProjectData } from "./useProjectData";
import type { Id } from "@/convex/_generated/dataModel";

type Phase = "prompt" | "storyboard" | "video" | "editor";

interface PhaseGuardProps {
  requiredPhase: Phase;
  children: React.ReactNode;
  allowEditorAlways?: boolean;
  /**
   * Skip redirecting to a fallback phase when locked. Useful when we want to show the
   * target page (e.g., to surface next steps) even if gating data is missing.
   */
  disableRedirect?: boolean;
  /**
   * When true, render children even if the required phase is not unlocked.
   * Requires a project to exist; otherwise we still return null.
   */
  allowWhenLocked?: boolean;
}

const getPhaseOrder = (phase: Phase): number => {
  const order = { prompt: 0, storyboard: 1, video: 2, editor: 3 };
  return order[phase];
};

export const PhaseGuard = ({
  requiredPhase,
  children,
  allowEditorAlways = false,
  disableRedirect = false,
  allowWhenLocked = false,
}: PhaseGuardProps) => {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const projectId = params?.projectId as string;
  const isArchive = pathname?.includes("/archive/");
  const basePrefix = isArchive ? "/archive" : "";

  const { project, questions, scenes, clips, isLoading } = useProjectData(
    projectId as Id<"videoProjects">,
  );

  // Determine which phases are unlocked based on data
  const hasAnswers = questions?.answers !== undefined;
  const hasScenes = scenes && scenes.length > 0;
  const hasClips = clips && clips.length > 0;
  const allClipsComplete =
    hasClips && clips.every((clip) => clip.status === "complete");

  const isPhaseUnlocked = (phase: Phase): boolean => {
    if (phase === "editor" && allowEditorAlways) return true;
    switch (phase) {
      case "prompt":
        return true; // Always accessible
      case "storyboard":
        return hasAnswers || hasScenes;
      case "video":
        return hasScenes;
      case "editor":
        return hasClips && allClipsComplete;
      default:
        return false;
    }
  };

  const furthestUnlockedPhase = (): Phase => {
    if (allClipsComplete) return "editor";
    if (hasScenes) return "video";
    if (hasAnswers) return "storyboard";
    return "prompt";
  };

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // If project doesn't exist, redirect to /new
    if (!project) {
      router.push(`${basePrefix}/new`);
      return;
    }

    // Check if the required phase is unlocked
    const phaseUnlocked = isPhaseUnlocked(requiredPhase);

    if (!phaseUnlocked && !disableRedirect) {
      // Redirect to furthest unlocked phase
      const fallbackPhase = furthestUnlockedPhase();
      router.push(`${basePrefix}/${projectId}/${fallbackPhase}`);
    }
  }, [
    isLoading,
    project,
    projectId,
    router,
    requiredPhase,
    hasAnswers,
    hasScenes,
    hasClips,
    allClipsComplete,
    disableRedirect,
  ]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  // Show nothing if no project or phase not unlocked
  if (!project) {
    return null;
  }

  if (!isPhaseUnlocked(requiredPhase) && !allowWhenLocked) {
    return null;
  }

  // Render children if phase is unlocked
  return <>{children}</>;
};
