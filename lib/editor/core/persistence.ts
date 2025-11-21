import type { Project } from "../types";

export interface PersistedHistory {
  past: Project[];
  future: Project[];
}

const STORAGE_KEY = "editor-project-persistence";

const saveLocal = async (payload: { project: Project; history: PersistedHistory }) => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("ProjectPersistence.save (local) failed", error);
  }
};

const loadLocal = async (): Promise<{ project: Project; history: PersistedHistory } | null> => {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("ProjectPersistence.load (local) failed", error);
    return null;
  }
};

export const ProjectPersistence = {
  async save(payload: { project: Project; history: PersistedHistory; projectId?: string }) {
    // Save locally
    await saveLocal({ project: payload.project, history: payload.history });

    // Save to Convex if projectId provided
    if (!payload.projectId) return;
    try {
      await fetch("/api/editor-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: payload.projectId,
          projectData: payload.project,
          sequenceNumber: Date.now(),
        }),
      });
    } catch (error) {
      console.warn("ProjectPersistence.save (convex) failed", error);
    }
  },

  async load(projectId?: string): Promise<{ project: Project; history: PersistedHistory } | null> {
    // Try Convex first if projectId
    if (projectId) {
      try {
        const res = await fetch(`/api/editor-state?projectId=${projectId}`, { cache: "no-store" });
        if (res.ok) {
          const remote = await res.json();
          if (remote?.projectData) {
            return {
              project: remote.projectData as Project,
              history: remote.history as PersistedHistory,
            };
          }
        }
      } catch (error) {
        console.warn("ProjectPersistence.load (convex) failed", error);
      }
    }
    // Fallback to local
    return loadLocal();
  },
};
