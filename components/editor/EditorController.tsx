"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useSnapManager } from "@/lib/editor/hooks/useSnapManager";
import { BeatGridOverlay } from "./BeatGridOverlay";
import { ThumbnailInjector } from "./ThumbnailInjector";
import { ElementIdInjector } from "./ElementIdInjector";

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
  const selection = useProjectStore((state) => state.selection);
  const rippleEditEnabled = useProjectStore((state) => state.rippleEditEnabled);
  const assets = project?.mediaAssets ?? {};

  // Beat grid support
  const { beatMarkers } = useSnapManager();
  const [containerWidth, setContainerWidth] = useState(1200);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Global keyboard shortcuts for editor operations
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // S key: Split clip at playhead
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        const selectedClipId = selection.clipIds[0];
        if (selectedClipId) {
          console.log('[EditorController] Splitting clip at playhead:', selectedClipId);
          actions.splitAtPlayhead(selectedClipId);
        } else {
          console.log('[EditorController] No clip selected for split operation');
        }
      }

      // Delete key: Remove selected clip (with ripple edit if enabled)
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        const selectedClipId = selection.clipIds[0];
        if (selectedClipId) {
          console.log('[EditorController] Deleting clip:', selectedClipId, 'Ripple:', rippleEditEnabled);
          if (rippleEditEnabled) {
            actions.rippleDelete(selectedClipId);
          } else {
            actions.deleteClip(selectedClipId);
          }
        } else {
          console.log('[EditorController] No clip selected for delete operation');
        }
      }

      // R key: Toggle ripple edit mode
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        console.log('[EditorController] Toggling ripple edit mode');
        actions.toggleRippleEdit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selection, rippleEditEnabled, actions]);

  // Expose Twick editor methods and project store actions to window for debugging and external access
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
        // Project store actions for keyboard shortcuts
        projectStore: {
          toggleRippleEdit: actions.toggleRippleEdit,
          splitAtPlayhead: actions.splitAtPlayhead,
          deleteClip: actions.deleteClip,
          rippleDelete: actions.rippleDelete,
          rippleEditEnabled,
        },
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__twickEditor;
      }
    };
  }, [editor, togglePlayback, addElement, updateElement, splitElement, deleteItem, handleUndo, handleRedo, livePlayerContext, actions, rippleEditEnabled]);

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

  // Track container width for beat grid overlay
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Observe Twick timeline scroll for beat grid sync
  useEffect(() => {
    // Use setTimeout to ensure Twick has rendered
    const findAndAttachScrollListener = () => {
      const timelineScrollContainer = document.querySelector('.twick-timeline-scroll-container');

      if (!timelineScrollContainer) {
        return false;
      }

      const handleScroll = () => {
        setScrollLeft(timelineScrollContainer.scrollLeft);
      };

      timelineScrollContainer.addEventListener('scroll', handleScroll);
      // Get initial scroll position
      handleScroll();

      return () => {
        timelineScrollContainer.removeEventListener('scroll', handleScroll);
      };
    };

    // Try immediately
    let cleanup = findAndAttachScrollListener();

    // If not found, retry with delays
    if (!cleanup) {
      const timeouts: NodeJS.Timeout[] = [];
      [100, 500, 1000].forEach(delay => {
        timeouts.push(setTimeout(() => {
          if (!cleanup) {
            cleanup = findAndAttachScrollListener();
          }
        }, delay));
      });

      return () => {
        timeouts.forEach(t => clearTimeout(t));
      };
    }

    return cleanup;
  }, []);

  const sequence = project?.sequences[0];
  const duration = sequence?.duration ?? 300; // Default 5 minutes

  return (
    <div ref={containerRef} id="twick-timeline-only" className="relative h-full w-full">
      {/* Timeline thumbnail injectors - add thumbnails to timeline elements */}
      <ThumbnailInjector />
      <ElementIdInjector />

      <VideoEditor
        editorConfig={{
          videoProps: {
            width: sequence?.width ?? 1920,
            height: sequence?.height ?? 1080,
          },
          timelineTickConfigs: DEFAULT_TIMELINE_TICK_CONFIGS,
        }}
      />

      {/* Beat Grid Overlay */}
      {beatMarkers.length > 0 && (
        <BeatGridOverlay
          beatMarkers={beatMarkers}
          duration={duration}
          containerWidth={containerWidth}
          scrollLeft={scrollLeft}
          zoom={1.5} // Twick's default zoom
        />
      )}
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