"use client";

import { useEffect, useMemo, useRef } from "react";
import { DEFAULT_TIMELINE_TICK_CONFIGS } from "@twick/video-editor";
import { LivePlayerProvider } from "@twick/live-player";
import { TimelineProvider, useTimelineContext, TimelineEditor } from "@twick/timeline";
import { projectToTimelineJSON, timelineToProject } from "@/lib/editor/twick-adapter";
import { useProjectStore } from "@/lib/editor/core/project-store";

const EditorBridge = () => {
  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);
  const actions = useProjectStore((state) => state.actions);
  const assets = project?.mediaAssets ?? {};
  const { editor, present, changeLog, selectedItem } = useTimelineContext();
  // Track the last signatures we pushed in each direction to avoid feedback loops.
  const lastProjectSignature = useRef<string | null>(null);
  const lastTimelineSignature = useRef<string | null>(null);
  const pushingProjectToTimeline = useRef(false);
  const pushingTimelineToProject = useRef(false);

  // Sync Twick selection to Project Store
  useEffect(() => {
    if (selectedItem && 'id' in selectedItem) {
      // We assume it's a clip/element if it has an ID. 
      // Twick types distinguish Track vs TrackElement, but both have IDs.
      // For now, we just select it. The properties panel will decide if it's valid.
      actions.setSelection({ clipIds: [(selectedItem as any).id], trackIds: [] });
    } else {
      actions.setSelection({ clipIds: [], trackIds: [] });
    }
  }, [selectedItem, actions]);

  useEffect(() => {
    if (!ready || !project) return;
    if (pushingTimelineToProject.current) {
      // Skip reacting to changes we initiated from the timeline->project sync.
      pushingTimelineToProject.current = false;
      return;
    }

    const timeline = projectToTimelineJSON(project);
    const signature = JSON.stringify(timeline);

    if (lastProjectSignature.current === signature) return;

    pushingProjectToTimeline.current = true;
    editor.loadProject(timeline);
    lastProjectSignature.current = signature;
    lastTimelineSignature.current = signature; // keep both in sync after a push
    pushingProjectToTimeline.current = false;
  }, [assets, editor, project, ready]);

  useEffect(() => {
    if (!ready || !project || !present) return;
    if (pushingProjectToTimeline.current) {
      // Skip reacting to changes we initiated from the project->timeline sync.
      pushingProjectToTimeline.current = false;
      return;
    }

    const signature = JSON.stringify(present);
    if (lastTimelineSignature.current === signature) return;

    const nextProject = timelineToProject(project, present, assets);
    lastTimelineSignature.current = signature;
    pushingTimelineToProject.current = true;
    void actions.loadProject(nextProject, { persist: true });
  }, [actions, assets, changeLog, present, project, ready]);

  return (
    // @ts-expect-error -- Library type definition mismatch
    <TimelineEditor 
      tickConfigs={DEFAULT_TIMELINE_TICK_CONFIGS}
    />
  );
};

export const EditorController = () => {
  // Performance optimization: Only subscribe to project ID for the initial data serialization
  // Updates are handled by the inner EditorBridge component
  const project = useProjectStore((state) => state.project);
  const projectId = project?.id;
  
  // Only re-calculate initialData when the project ID changes, NOT on every update.
  // This prevents TimelineProvider from re-mounting/resetting during editing.
  const initialData = useMemo(
    () => (project ? projectToTimelineJSON(project) : undefined),
    [projectId], 
  );

  if (!project) return null;

  return (
    <div className="h-full w-full bg-background">
      <LivePlayerProvider>
        <TimelineProvider
          contextId="twick-editor"
          resolution={{
            width: project.sequences[0]?.width ?? 1920,
            height: project.sequences[0]?.height ?? 1080,
          }}
          initialData={
            initialData ?? {
              tracks: [],
              version: 1,
            }
          }
          undoRedoPersistenceKey={`twick-history-${projectId}`}
          maxHistorySize={150}
        >
          <EditorBridge />
        </TimelineProvider>
      </LivePlayerProvider>
    </div>
  );
};

export default EditorController;