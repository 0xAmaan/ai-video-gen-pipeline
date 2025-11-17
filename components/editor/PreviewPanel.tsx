"use client";

import { memo, useEffect, useRef, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "../ui/button";

interface PreviewPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
  onCanvasResize?: (width: number, height: number) => void;
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
  onCanvasResize,
}: PreviewPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  // Debounced resize handler
  const handleResize = useCallback(
    (entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (!entry || !onCanvasResize) return;

      const { width, height } = entry.contentRect;

      // Clear previous timeout
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }

      // Debounce resize events (150ms)
      resizeTimeoutRef.current = window.setTimeout(() => {
        // Calculate canvas dimensions maintaining 16:9 aspect ratio
        const aspectRatio = 16 / 9;
        const containerAspect = width / height;

        let canvasWidth: number;
        let canvasHeight: number;

        if (containerAspect > aspectRatio) {
          // Container wider than 16:9 - fit to height
          canvasHeight = Math.floor(height);
          canvasWidth = Math.floor(height * aspectRatio);
        } else {
          // Container taller than 16:9 - fit to width
          canvasWidth = Math.floor(width);
          canvasHeight = Math.floor(width / aspectRatio);
        }

        // Only resize if change is significant (>10% or >50px)
        const widthDelta = Math.abs(canvasWidth - lastSizeRef.current.width);
        const heightDelta = Math.abs(canvasHeight - lastSizeRef.current.height);
        const widthPercentChange = widthDelta / lastSizeRef.current.width;
        const heightPercentChange = heightDelta / lastSizeRef.current.height;

        if (
          lastSizeRef.current.width === 0 ||
          widthDelta > 50 ||
          heightDelta > 50 ||
          widthPercentChange > 0.1 ||
          heightPercentChange > 0.1
        ) {
          lastSizeRef.current = { width: canvasWidth, height: canvasHeight };
          onCanvasResize(canvasWidth, canvasHeight);
        }
      }, 150);
    },
    [onCanvasResize],
  );

  // Setup ResizeObserver
  useEffect(() => {
    if (!containerRef.current || !onCanvasResize) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize, onCanvasResize]);

  return (
    <div className="flex h-full flex-col gap-3 border-r border-border bg-card/50 p-4">
      {/* Aspect ratio wrapper to maintain 16:9 and prevent distortion */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain rounded-md bg-black"
          width={1280}
          height={720}
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          onClick={onTogglePlayback}
          aria-label="Toggle playback"
          className="shrink-0"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
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

// Memoize to prevent re-renders when only currentTime changes
// Canvas updates independently via PreviewRenderer
export const PreviewPanel = memo(
  PreviewPanelComponent,
  (prevProps, nextProps) => {
    // Only re-render if these props change (ignore currentTime for now)
    return (
      prevProps.canvasRef === nextProps.canvasRef &&
      prevProps.duration === nextProps.duration &&
      prevProps.isPlaying === nextProps.isPlaying &&
      prevProps.onTogglePlayback === nextProps.onTogglePlayback &&
      prevProps.onSeek === nextProps.onSeek
      // Note: currentTime is intentionally excluded to reduce re-renders
      // The time display will update less frequently, but canvas rendering is smooth
    );
  },
);
