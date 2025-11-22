"use client";

import { useEffect, useMemo, useRef } from "react";
import VideoEditor, {
  DEFAULT_TIMELINE_TICK_CONFIGS,
  usePlayerControl,
  useEditorManager,
  useTimelineControl,
} from "@twick/video-editor";
import { LivePlayerProvider, useLivePlayerContext } from "@twick/live-player";
import { TimelineProvider, useTimelineContext } from "@twick/timeline";
import { projectToTimelineJSON, timelineToProject } from "@/lib/editor/twick-adapter";
import { useProjectStore } from "@/lib/editor/core/project-store";

// Type guard for Twick selected items with IDs
interface TwickItemWithId {
  id: string;
  [key: string]: unknown;
}

function isItemWithId(item: unknown): item is TwickItemWithId {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof (item as TwickItemWithId).id === 'string'
  );
}

const EditorBridge = () => {
  const ready = useProjectStore((state) => state.ready);
  const project = useProjectStore((state) => state.project);
  const actions = useProjectStore((state) => state.actions);
  const assets = project?.mediaAssets ?? {};
  
  // Twick hooks integration
  const { editor, present, changeLog, selectedItem } = useTimelineContext();
  const { togglePlayback } = usePlayerControl();
  const { addElement, updateElement } = useEditorManager();
  const { splitElement, deleteItem, handleUndo, handleRedo } = useTimelineControl();
  const livePlayerContext = useLivePlayerContext();
  // Track the last signatures we pushed in each direction to avoid feedback loops.
  const lastProjectSignature = useRef<string | null>(null);
  const lastTimelineSignature = useRef<string | null>(null);
  const pushingProjectToTimeline = useRef(false);
  const pushingTimelineToProject = useRef(false);

  // Sync Twick selection to Project Store
  useEffect(() => {
    if (isItemWithId(selectedItem)) {
      // We assume it's a clip/element if it has an ID. 
      // Twick types distinguish Track vs TrackElement, but both have IDs.
      // For now, we just select it. The properties panel will decide if it's valid.
      console.log('[EditorController] Syncing selection to store:', selectedItem.id);
      actions.setSelection({ clipIds: [selectedItem.id], trackIds: [] });
    } else {
      console.log('[EditorController] Clearing selection');
      actions.setSelection({ clipIds: [], trackIds: [] });
    }
  }, [selectedItem, actions]);

  // Sync playback state between LivePlayer and Project Store
  useEffect(() => {
    if (!livePlayerContext) return;
    const { playerState } = livePlayerContext;
    
    // Sync play/pause state
    const isPlaying = playerState?.playing ?? false;
    const storeIsPlaying = useProjectStore.getState().isPlaying;
    
    if (isPlaying !== storeIsPlaying) {
      actions.togglePlayback(isPlaying);
    }
  }, [livePlayerContext, actions]);

  // Expose Twick editor methods to window for debugging and external access
  useEffect(() => {
    if (typeof window !== 'undefined' && editor) {
      (window as any).__twickEditor = {
        editor,
        togglePlayback,
        addElement,
        updateElement,
        splitElement,
        deleteItem,
        undo: handleUndo,
        redo: handleRedo,
        livePlayerContext,
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__twickEditor;
      }
    };
  }, [editor, togglePlayback, addElement, updateElement, splitElement, deleteItem, handleUndo, handleRedo, livePlayerContext]);

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
    <div id="twick-timeline-only" className="h-full w-full">
      <VideoEditor
        editorConfig={{
          videoProps: {
            width: project?.sequences[0]?.width ?? 1920,
            height: project?.sequences[0]?.height ?? 1080,
          },
          timelineTickConfigs: DEFAULT_TIMELINE_TICK_CONFIGS,
        }}
      />
    </div>
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