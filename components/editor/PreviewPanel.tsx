"use client";

import { Play, Pause } from "lucide-react";
import { Button } from "../ui/button";

interface PreviewPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export const PreviewPanel = ({
  canvasRef,
  currentTime,
  duration,
  isPlaying,
  onTogglePlayback,
  onSeek,
}: PreviewPanelProps) => {
  return (
    <div className="flex h-full flex-col gap-3 border-r border-border bg-card/50 p-4">
      {/* Aspect ratio wrapper to maintain 16:9 and prevent distortion */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain rounded-md bg-black"
          width={1280}
          height={720}
          style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: '16/9' }}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" onClick={onTogglePlayback} aria-label="Toggle playback" className="flex-shrink-0">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={Math.min(currentTime, duration || 1)}
          className="flex-1"
          onChange={(event) => onSeek(parseFloat(event.target.value))}
        />
        <div className="text-xs text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
};
