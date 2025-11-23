"use client";

import { memo, useState, useEffect } from "react";
import {
  Play,
  Pause,
  Undo2,
  Redo2,
  Download,
  Volume2,
  VolumeX,
  Pencil,
  Check,
  X,
  Scissors,
  HelpCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { HelpDialog } from "./HelpDialog";

interface TopBarProps {
  title: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlayback: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  timelineMode?: "twick" | "legacy";
  onToggleTimelineMode?: () => void;
  masterVolume: number;
  onMasterVolumeChange: (value: number) => void;
  audioTrackMuted: boolean;
  onToggleAudioTrack: () => void;
  selectedAudioClipVolume?: number;
  onAudioClipVolumeChange?: (value: number) => void;
  onTitleChange?: (newTitle: string) => void;
  rippleEditEnabled?: boolean;
  onToggleRippleEdit?: () => void;
  multiTrackRipple?: boolean;
  onToggleMultiTrackRipple?: () => void;
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
  timelineMode,
  onToggleTimelineMode,
  masterVolume,
  onMasterVolumeChange,
  audioTrackMuted,
  onToggleAudioTrack,
  selectedAudioClipVolume,
  onAudioClipVolumeChange,
  onTitleChange,
  rippleEditEnabled,
  onToggleRippleEdit,
  multiTrackRipple,
  onToggleMultiTrackRipple,
}: TopBarProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [helpOpen, setHelpOpen] = useState(false);

  const startEdit = () => {
    setIsEditing(true);
    setEditTitle(title);
  };

  const saveEdit = () => {
    if (editTitle.trim() && onTitleChange) {
      onTitleChange(editTitle.trim());
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditTitle(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Global keyboard shortcut for help dialog (Cmd+/ or Ctrl+/)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+/ (Mac) or Ctrl+/ (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-2">
      <div className="flex items-center gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Project
        </p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary max-w-md"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={saveEdit}
              className="h-7 w-7"
            >
              <Check className="h-3.5 w-3.5 text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={cancelEdit}
              className="h-7 w-7"
            >
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-semibold truncate max-w-md">{title}</h1>
            {onTitleChange && (
              <Button
                variant="ghost"
                size="icon"
                onClick={startEdit}
                className="h-6 w-6 hover:bg-primary/20"
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={onUndo}
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onRedo}
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          {onToggleRippleEdit && (
            <div className="flex items-center gap-1">
              <Button
                variant={rippleEditEnabled ? "default" : "outline"}
                size="sm"
                onClick={onToggleRippleEdit}
                aria-label="Toggle ripple edit mode"
                className="gap-2"
                title="Toggle Ripple Mode (R)"
              >
                <Scissors className="h-4 w-4" />
                {rippleEditEnabled && (
                  <span className="hidden sm:inline text-xs">RIPPLE</span>
                )}
              </Button>
              {rippleEditEnabled && onToggleMultiTrackRipple && (
                <Button
                  variant={multiTrackRipple ? "default" : "outline"}
                  size="sm"
                  onClick={onToggleMultiTrackRipple}
                  aria-label="Toggle multi-track ripple"
                  title="Multi-Track Ripple: Affects all unlocked tracks"
                  className="gap-1 px-2"
                >
                  <span className="text-xs font-mono">{multiTrackRipple ? "ALL" : "1"}</span>
                </Button>
              )}
            </div>
          )}
          {onToggleTimelineMode && timelineMode && (
            <Button variant="outline" size="sm" onClick={onToggleTimelineMode}>
              Timeline: {timelineMode === "twick" ? "Twick" : "Legacy"}
            </Button>
          )}
          <Button onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHelpOpen(true)}
            title="Help & Keyboard Shortcuts"
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3 border-l border-border pl-4">
          <Button
            variant={audioTrackMuted ? "destructive" : "outline"}
            size="icon"
            onClick={onToggleAudioTrack}
            aria-label="Toggle audio track mute"
          >
            {audioTrackMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <div className="flex items-center gap-2 w-32">
            <Slider
            value={[masterVolume]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={([value]) =>
              onMasterVolumeChange(value ?? masterVolume)
            }
          />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
          {selectedAudioClipVolume !== undefined &&
            onAudioClipVolumeChange && (
              <div className="hidden lg:flex items-center gap-2 w-36">
                <span className="text-xs text-muted-foreground">Clip</span>
                <Slider
                  value={[selectedAudioClipVolume]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([value]) =>
                    onAudioClipVolumeChange(
                      value ?? selectedAudioClipVolume,
                    )
                  }
                />
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {Math.round(selectedAudioClipVolume * 100)}%
                </span>
              </div>
            )}
        </div>
      </div>

      {/* Help Dialog */}
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
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
    prevProps.onExport === nextProps.onExport &&
    prevProps.masterVolume === nextProps.masterVolume &&
    prevProps.audioTrackMuted === nextProps.audioTrackMuted &&
    prevProps.selectedAudioClipVolume === nextProps.selectedAudioClipVolume &&
    prevProps.timelineMode === nextProps.timelineMode &&
    prevProps.onToggleTimelineMode === nextProps.onToggleTimelineMode &&
    prevProps.onTitleChange === nextProps.onTitleChange &&
    prevProps.rippleEditEnabled === nextProps.rippleEditEnabled &&
    prevProps.onToggleRippleEdit === nextProps.onToggleRippleEdit &&
    prevProps.multiTrackRipple === nextProps.multiTrackRipple &&
    prevProps.onToggleMultiTrackRipple === nextProps.onToggleMultiTrackRipple
    // Note: currentTime intentionally excluded to reduce re-renders
  );
});
