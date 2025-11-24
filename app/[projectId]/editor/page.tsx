"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { OpenCutEditorShell } from "@/components/editor/OpenCutEditorShell";
import { useProjectData } from "@/app/archive/[projectId]/_components/useProjectData";
import { adaptConvexProjectToStandalone } from "@/lib/editor/convex-adapter";
import { useProjectStore } from "@/lib/editor/core/project-store";
import type { Id } from "@/convex/_generated/dataModel";
import { buildOpenCutSnapshot } from "@/lib/opencut/snapshot";
import { storageService } from "@/lib/opencut/storage-service";

type SnapshotState = "idle" | "converting" | "ready" | "error";

const OpenCutEditorPage = () => {
  const params = useParams();
  const projectId = params?.projectId as string;
  const convexProjectId = projectId ? (projectId as Id<"videoProjects">) : null;
  const { project, scenes, clips, audioAssets, isLoading } = useProjectData(
    convexProjectId,
  );
  const actions = useProjectStore((state) => state.actions);
  const lastSignatureRef = useRef<string | null>(null);

  const adaptedProject = useMemo(() => {
    if (!project) return null;
    return adaptConvexProjectToStandalone({
      project,
      clips,
      scenes,
      audioAssets,
    });
  }, [project, clips, scenes, audioAssets]);

  const [snapshotState, setSnapshotState] = useState<SnapshotState>("idle");
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [progress, setProgress] = useState<{ completed: number; total: number; current?: string }>(
    { completed: 0, total: 0 },
  );
  const [retryNonce, setRetryNonce] = useState(0);

  // Reset project store when projectId changes
  useEffect(() => {
    actions.reset();
    lastSignatureRef.current = null;
  }, [actions, projectId]);

  // Load project into store when data is ready
  useEffect(() => {
    if (!adaptedProject) return;
    if (lastSignatureRef.current === adaptedProject.signature) return;
    void actions.loadProject(adaptedProject.project, { persist: false });
    lastSignatureRef.current = adaptedProject.signature;
  }, [adaptedProject, actions]);

  useEffect(() => {
    if (!adaptedProject) return;
    if (adaptedProject.readyClipCount === 0) return;

    let cancelled = false;
    const controller = new AbortController();
    const totalAssets = Object.keys(adaptedProject.project.mediaAssets).length;
    setSnapshotState("converting");
    setSnapshotError(null);
    setProgress({ completed: 0, total: totalAssets });

    (async () => {
      try {
        const snapshot = await buildOpenCutSnapshot(adaptedProject.project, {
          signal: controller.signal,
          onAssetLoaded: ({ completed, total, name }) => {
            if (!cancelled) {
              setProgress({ completed, total, current: name });
            }
          },
        });

        if (cancelled) return;
        storageService.hydrateFromSnapshot(snapshot);
        setSnapshotState("ready");
        setSnapshotVersion((value) => value + 1);
      } catch (error) {
        if (cancelled) return;
        setSnapshotState("error");
        setSnapshotError(
          error instanceof Error
            ? error.message
            : "Failed to prepare OpenCut project",
        );
      }
    })();

    return () => {
      cancelled = true;
      controller.abort("Component unmounted");
    };
  }, [adaptedProject?.signature, adaptedProject?.readyClipCount, retryNonce]);

  const shouldShowNotReady = useMemo(() => {
    if (!adaptedProject) return false;
    return adaptedProject.readyClipCount === 0;
  }, [adaptedProject]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Preparing project data...
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center text-muted-foreground">
        <p className="font-medium text-foreground">Invalid project URL.</p>
        <Link
          href="/projects"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          View projects
        </Link>
      </div>
    );
  }

  if (!project || !adaptedProject) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center text-muted-foreground">
        <p className="font-medium text-foreground">Project not found or inaccessible.</p>
        <p className="max-w-md text-sm">
          Double-check the project link or return to your project list to pick a valid project.
        </p>
        <Link
          href="/projects"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          View projects
        </Link>
      </div>
    );
  }

  if (shouldShowNotReady) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <p className="font-medium text-foreground">Waiting for AI clips to finish rendering</p>
        <p className="max-w-md text-sm">
          We&apos;ll automatically pull clips into the OpenCut editor as soon as they complete. Keep this tab open or
          refresh in a bit.
        </p>
      </div>
    );
  }

  if (snapshotState === "converting") {
    const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <p className="font-medium text-foreground">Preparing OpenCut workspace…</p>
        <p className="text-sm">
          Downloading media ({progress.completed}/{progress.total}){progress.current ? ` • ${progress.current}` : ""}
        </p>
        <div className="w-64 rounded-full bg-muted/40">
          <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }

  if (snapshotState === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <p className="font-medium text-foreground">Failed to open project in OpenCut.</p>
        <p className="text-sm max-w-md">{snapshotError}</p>
        <button
          type="button"
          onClick={() => setRetryNonce((value) => value + 1)}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  if (snapshotState !== "ready") {
    return null;
  }

  return <OpenCutEditorShell projectId={projectId} key={snapshotVersion} />;
};

export default OpenCutEditorPage;
