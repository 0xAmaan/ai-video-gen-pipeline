"use client";

import { useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { PhaseGuard } from "../_components/PhaseGuard";
import { useProjectData } from "../_components/useProjectData";
import { StandaloneEditorApp } from "@/components/editor/StandaloneEditorApp";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { adaptConvexProjectToStandalone } from "@/lib/editor/convex-adapter";
import { useConvexProjectSync } from "@/lib/editor/hooks/useConvexProjectSync";
import type { Id } from "@/convex/_generated/dataModel";

const IntegratedStandaloneEditorPage = () => {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { project, scenes, clips, audioAssets, isLoading } = useProjectData(
    projectId as Id<"videoProjects">,
  );
  const actions = useProjectStore((state) => state.actions);
  const lastSignatureRef = useRef<string | null>(null);
  const { hydratedFromRemote } = useConvexProjectSync(projectId as Id<"videoProjects">);

  const adaptedProject = useMemo(() => {
    if (!project) return null;
    return adaptConvexProjectToStandalone({
      project,
      clips,
      scenes,
      audioAssets,
    });
  }, [project, clips, scenes, audioAssets]);

  useEffect(() => {
    actions.reset();
    lastSignatureRef.current = null;
  }, [actions, projectId]);

  useEffect(() => {
    if (!adaptedProject || hydratedFromRemote) return;
    if (lastSignatureRef.current === adaptedProject.signature) return;
    void actions.loadProject(adaptedProject.project, { persist: false });
    lastSignatureRef.current = adaptedProject.signature;
  }, [adaptedProject, actions, hydratedFromRemote]);

  return (
    <PhaseGuard requiredPhase="editor">
      {isLoading || !project ? (
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          Preparing project data...
        </div>
      ) : adaptedProject?.readyClipCount === 0 ? (
        <div className="flex h-screen flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <p className="font-medium text-foreground">
            Waiting for AI clips to finish rendering
          </p>
          <p className="max-w-md text-sm">
            We&apos;ll automatically pull clips into the standalone editor as
            soon as they complete. Keep this tab open or refresh in a bit.
          </p>
        </div>
      ) : (
        <StandaloneEditorApp
          autoHydrate={false}
          projectId={projectId}
        />
      )}
    </PhaseGuard>
  );
};

export default IntegratedStandaloneEditorPage;
