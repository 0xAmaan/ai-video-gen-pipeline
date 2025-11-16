"use client";

import { memo } from "react";
import {
  Play,
  Pause,
  Undo2,
  Redo2,
  Download,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";

interface TopBarProps {
  title: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlayback: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  masterVolume: number;
  onMasterVolumeChange: (value: number) => void;
  audioTrackMuted: boolean;
  onToggleAudioTrack: () => void;
  selectedAudioClipVolume?: number;
  onAudioClipVolumeChange?: (value: number) => void;
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
  masterVolume,
  onMasterVolumeChange,
  audioTrackMuted,
  onToggleAudioTrack,
  selectedAudioClipVolume,
  onAudioClipVolumeChange,
}: TopBarProps) => {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-2">
      <div className="flex items-center gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Project
        </p>
        <h1 className="text-sm font-semibold truncate max-w-md">{title}</h1>
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
          <Button
            variant="secondary"
            size="icon"
            onClick={onTogglePlayback}
            aria-label="Toggle playback"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" /> Export
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
    prevProps.selectedAudioClipVolume === nextProps.selectedAudioClipVolume
    // Note: currentTime intentionally excluded to reduce re-renders
  );
});
