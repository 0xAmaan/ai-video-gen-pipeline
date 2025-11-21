 "use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProjectStore } from "../core/project-store";
import type { Project } from "../types";

const DEBOUNCE_MS = 1000;

export const useConvexProjectSync = (projectId: Id<"videoProjects"> | null) => {
  const [hydratedFromRemote, setHydratedFromRemote] = useState(false);
  const saveProject = useMutation(api.video.saveProject);
  const persistent = useQuery(
    api.video.loadProjectState,
    projectId ? { projectId } : "skip",
  );
  const actions = useProjectStore((state) => state.actions);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const lastLoadedVersion = useRef<number | null>(null);

  useEffect(() => {
    if (!projectId || !persistent?.project) return;
    if (lastLoadedVersion.current === persistent.updatedAt) return;
    void actions.loadProject(persistent.project as Project, { persist: false });
    lastLoadedVersion.current = persistent.updatedAt ?? Date.now();
    setHydratedFromRemote(true);
  }, [actions, persistent?.project, persistent?.updatedAt, projectId]);

  useEffect(() => {
    if (!projectId) return;
    const unsubscribe = useProjectStore.subscribe((state) => {
      const project = state.project;
      if (!project) return;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void saveProject({ projectId, project, edl: project });
      }, DEBOUNCE_MS);
    });
    return unsubscribe;
  }, [projectId, saveProject]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  return { hydratedFromRemote };
};
