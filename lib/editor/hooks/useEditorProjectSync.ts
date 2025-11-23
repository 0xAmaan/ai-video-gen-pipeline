import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Project } from "../types";

/**
 * Hook to automatically sync a local editor project to Convex editorProjects table
 *
 * This hook:
 * 1. Creates a Convex editorProject when a local project is first loaded
 * 2. Returns the Convex project ID for use with asset uploads
 * 3. Only syncs once per project to avoid unnecessary mutations
 *
 * @param localProject - The local project from IndexedDB/Zustand
 * @param enabled - Whether to enable Convex sync (default: true)
 * @returns Convex project ID or null
 */
export function useEditorProjectSync(
  localProject: Project | null,
  enabled: boolean = true
): Id<"editorProjects"> | null {
  const [convexProjectId, setConvexProjectId] = useState<Id<"editorProjects"> | null>(null);
  const saveProject = useMutation(api.editor.saveProject);
  const syncedProjectIdRef = useRef<string | null>(null);
  const syncPromiseRef = useRef<Promise<Id<"editorProjects"> | null> | null>(null);

  useEffect(() => {
    if (!enabled || !localProject) {
      return;
    }

    // If we already synced this project, don't sync again
    if (syncedProjectIdRef.current === localProject.id) {
      return;
    }

    // If a sync is already in progress, reuse that promise
    if (syncPromiseRef.current) {
      return;
    }

    let cancelled = false;

    // Create or update the Convex project
    syncPromiseRef.current = (async () => {
      try {
        const convexId = await saveProject({
          projectId: localProject.id,
          projectData: localProject,
        });

        if (!cancelled) {
          setConvexProjectId(convexId);
          syncedProjectIdRef.current = localProject.id;
        }
        return convexId;
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to sync project to Convex:", err);
        }
        // Don't throw - allow local-only mode to continue working
        return null;
      } finally {
        syncPromiseRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [localProject, enabled, saveProject]);

  return convexProjectId;
}
