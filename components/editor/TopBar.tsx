"use client";

import { memo } from "react";
import { Play, Pause, Undo2, Redo2, Download } from "lucide-react";
import { Button } from "../ui/button";

interface TopBarProps {
  title: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlayback: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const TopBarComponent = ({
  title,
  isPlaying,
  currentTime,
  duration,
  onTogglePlayback,
  onUndo,
  onRedo,
  onExport,
}: TopBarProps) => {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-2">
      <div className="flex items-center gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
        <h1 className="text-sm font-semibold truncate max-w-md">{title}</h1>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <Button variant="outline" size="icon" onClick={onUndo} aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onRedo} aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={onTogglePlayback} aria-label="Toggle playback">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button onClick={onExport} className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>
    </div>
  );
};

// Memoize to prevent re-renders when only currentTime changes
export const TopBar = memo(TopBarComponent, (prevProps, nextProps) => {
  return (
    prevProps.title === nextProps.title &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.duration === nextProps.duration &&
    prevProps.onTogglePlayback === nextProps.onTogglePlayback &&
    prevProps.onUndo === nextProps.onUndo &&
    prevProps.onRedo === nextProps.onRedo &&
    prevProps.onExport === nextProps.onExport
    // Note: currentTime intentionally excluded to reduce re-renders
  );
});
