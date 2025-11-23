"use client";

import { useEnhancedTimeline } from "@/lib/editor/hooks";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Trash2,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TimelineToolbar Component
 * =========================
 *
 * Example component demonstrating the useEnhancedTimeline hook.
 * This toolbar provides common timeline editing controls with a clean,
 * unified API that abstracts away the complexity of managing multiple hooks.
 *
 * ## Benefits of useEnhancedTimeline:
 *
 * 1. **Single Import**: No need to import multiple hooks
 * 2. **Organized API**: Methods grouped by category (playback, editing, selection, etc.)
 * 3. **Type Safety**: Full TypeScript support with discriminated unions
 * 4. **Convenience Methods**: High-level operations like deleteSelectedClips()
 * 5. **Consistent Error Handling**: All operations return OperationResult<T>
 *
 * ## Before (multiple hooks):
 * ```tsx
 * const project = useProjectStore((state) => state.project);
 * const actions = useProjectStore((state) => state.actions);
 * const selection = useProjectStore((state) => state.selection);
 * const isPlaying = useProjectStore((state) => state.isPlaying);
 * const currentTime = useProjectStore((state) => state.currentTime);
 * const { getClipsInRange } = useTimelineQueries();
 * ```
 *
 * ## After (single hook):
 * ```tsx
 * const timeline = useEnhancedTimeline();
 * // Access everything through organized interface:
 * // timeline.playback.play()
 * // timeline.editing.delete()
 * // timeline.selection.selectClips()
 * // timeline.state.isPlaying
 * ```
 *
 * @component
 */
export function TimelineToolbar() {
  const timeline = useEnhancedTimeline();

  const handlePlayPause = () => {
    timeline.playback.togglePlayback();
  };

  const handleSkipBackward = () => {
    timeline.playback.shuttle(-5); // Jump back 5 seconds
  };

  const handleSkipForward = () => {
    timeline.playback.shuttle(5); // Jump forward 5 seconds
  };

  const handleSplitAtPlayhead = () => {
    const result = timeline.convenience.splitSelectedAtPlayhead();

    if (result.success) {
      console.log(`Split ${result.data} clip(s) at playhead`);
    } else {
      console.warn(`Split failed: ${result.error}`);
    }
  };

  const handleDelete = () => {
    const result = timeline.convenience.deleteSelectedClips();

    if (result.success) {
      console.log(`Deleted ${result.data} clip(s)`);
    } else {
      console.warn(`Delete failed: ${result.error}`);
    }
  };

  const handleUndo = () => {
    const result = timeline.editing.undo();
    if (!result.success) {
      console.warn(`Undo failed: ${result.error}`);
    }
  };

  const handleRedo = () => {
    const result = timeline.editing.redo();
    if (!result.success) {
      console.warn(`Redo failed: ${result.error}`);
    }
  };

  const canUndo = timeline.editing.canUndo();
  const canRedo = timeline.editing.canRedo();
  const hasSelection = timeline.selection.hasSelection();
  const selectedCount = timeline.selection.getSelectedClipIds().length;

  return (
    <div className="flex items-center gap-2 p-2 border-b bg-background">
      {/* Playback Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkipBackward}
          title="Skip backward 5s"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayPause}
          title={timeline.state.isPlaying ? "Pause" : "Play"}
        >
          {timeline.state.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkipForward}
          title="Skip forward 5s"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Editing Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          disabled={!canUndo}
          title={timeline.editing.getUndoDescription() ?? "Undo"}
        >
          <Undo className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRedo}
          disabled={!canRedo}
          title={timeline.editing.getRedoDescription() ?? "Redo"}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Clip Operations */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSplitAtPlayhead}
          disabled={!hasSelection}
          title="Split selected clips at playhead (⌘B)"
        >
          <Scissors className="h-4 w-4" />
          {hasSelection && selectedCount > 1 && (
            <span className="ml-1 text-xs">({selectedCount})</span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={!hasSelection}
          title="Delete selected clips (⌫)"
          className={cn(
            hasSelection && "text-destructive hover:text-destructive"
          )}
        >
          <Trash2 className="h-4 w-4" />
          {hasSelection && selectedCount > 1 && (
            <span className="ml-1 text-xs">({selectedCount})</span>
          )}
        </Button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Timeline Info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
        <span>
          {timeline.state.currentTime.toFixed(2)}s
        </span>
        {hasSelection && (
          <span className="font-medium text-foreground">
            {selectedCount} clip{selectedCount !== 1 ? "s" : ""} selected
          </span>
        )}
        {timeline.state.rippleEditEnabled && (
          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded text-xs font-medium">
            Ripple
          </span>
        )}
      </div>
    </div>
  );
}
