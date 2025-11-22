"use client";

import { memo } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "../ui/button";

interface PreviewPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
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

const PreviewPanelComponent = ({
  canvasRef,
  currentTime,
  duration,
  isPlaying,
  onTogglePlayback,
  onSeek,
}: PreviewPanelProps) => {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Canvas Container: Flexbox centers the canvas, object-contain preserves aspect ratio */}
      <div className="flex-1 flex items-center justify-center bg-black min-h-0 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          // Set initial resolution; PreviewRenderer will update this if needed, 
          // but CSS controls the display size.
          width={1920}
          height={1080}
        />
      </div>
      
      {/* Controls Bar */}
      <div className="flex-none h-12 flex items-center gap-3 px-4 border-t border-border bg-card/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePlayback}
          aria-label="Toggle playback"
          className="shrink-0 h-8 w-8 hover:bg-primary/10"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 ml-0.5 fill-current" />
          )}
        </Button>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={Math.min(currentTime, duration || 1)}
          className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
          onChange={(event) => onSeek(parseFloat(event.target.value))}
        />
        <div className="text-xs font-mono text-muted-foreground w-24 text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
};

export const PreviewPanel = memo(PreviewPanelComponent);
