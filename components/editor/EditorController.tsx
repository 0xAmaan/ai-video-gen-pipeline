"use client";

import { useEffect, useMemo, useRef } from "react";
import VideoEditor, { DEFAULT_TIMELINE_TICK_CONFIGS } from "@twick/video-editor";
import { LivePlayerProvider } from "@twick/live-player";
import { TimelineProvider, useTimelineContext } from "@twick/timeline";
import { projectToTimelineJSON, timelineToProject } from "@/lib/editor/twick-adapter";
import { useProjectStore } from "@/lib/editor/core/project-store";

const EditorBridge = () => {
  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);
  const actions = useProjectStore((state) => state.actions);
  const assets = project?.mediaAssets ?? {};
  const { editor, present, changeLog } = useTimelineContext();
  // Track the last signatures we pushed in each direction to avoid feedback loops.
  const lastProjectSignature = useRef<string | null>(null);
  const lastTimelineSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !project) return;
    const timeline = projectToTimelineJSON(project);
    const signature = JSON.stringify(timeline);

    if (lastProjectSignature.current === signature) return;

    editor.loadProject(timeline);
    lastProjectSignature.current = signature;
    lastTimelineSignature.current = signature; // keep both in sync after a push
  }, [assets, editor, project, ready]);

  useEffect(() => {
    if (!ready || !project || !present) return;
    const signature = JSON.stringify(present);
    if (lastTimelineSignature.current === signature) return;

    const nextProject = timelineToProject(project, present, assets);
    lastTimelineSignature.current = signature;
    void actions.loadProject(nextProject, { persist: true });
  }, [actions, assets, changeLog, present, project, ready]);

  return (
    <VideoEditor
      defaultPlayControls
      editorConfig={{
        videoProps: {
          width: project?.sequences[0]?.width ?? 1920,
          height: project?.sequences[0]?.height ?? 1080,
        },
        timelineTickConfigs: DEFAULT_TIMELINE_TICK_CONFIGS,
      }}
    />
  );
};

export const EditorController = () => {
  const project = useProjectStore((state) => state.project);
  const initialData = useMemo(
    () => (project ? projectToTimelineJSON(project) : undefined),
    [project?.updatedAt],
  );

  return (
    <LivePlayerProvider>
      <TimelineProvider
        contextId="twick-editor"
        resolution={{
          width: project?.sequences[0]?.width ?? 1920,
          height: project?.sequences[0]?.height ?? 1080,
        }}
        initialData={
          initialData ?? {
            tracks: [],
            version: 1,
          }
        }
        undoRedoPersistenceKey="twick-editor-history"
        maxHistorySize={150}
      >
        <EditorBridge />
      </TimelineProvider>
    </LivePlayerProvider>
  );
};

export default EditorController;
