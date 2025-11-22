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

  // Track previous project state to detect actual changes
  const previousProjectRef = useRef<Project | null>(null);
  const previousProjectJsonRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    // Subscribe to all state changes, but filter for project changes
    const unsubscribe = useProjectStore.subscribe((state) => {
      const project = state.project;
      if (!project) return;

      // Skip if project hasn't actually changed (same object reference)
      if (previousProjectRef.current === project) {
        return;
      }

      // Deep equality check to prevent saves when only reference changed
      // This handles the case where loadProject() does deepClone() creating new references
      const projectJson = JSON.stringify(project);
      if (previousProjectJsonRef.current === projectJson) {
        // Content hasn't changed, just update reference and skip save
        previousProjectRef.current = project;
        return;
      }

      // Skip initial hydration from remote to prevent save loop
      if (!previousProjectRef.current && !hydratedFromRemote) {
        previousProjectRef.current = project;
        previousProjectJsonRef.current = projectJson;
        return;
      }

      previousProjectRef.current = project;
      previousProjectJsonRef.current = projectJson;

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        // Only save project state, not redundant EDL copy
        void saveProject({ projectId, project });
      }, DEBOUNCE_MS);
    });
    
    return unsubscribe;
  }, [projectId, saveProject, hydratedFromRemote]);

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
