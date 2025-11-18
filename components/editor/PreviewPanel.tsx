"use client";

import { memo, useEffect, useRef, useCallback, useState } from "react";
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

const PREVIEW_ASPECT_RATIO = 16 / 9;

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
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });

  // Debounced resize handler
  const handleResize = useCallback(
    (entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (!entry || !onCanvasResize) return;

      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;

      // Calculate dimensions that preserve aspect ratio
      const widthLimitedHeight = width / PREVIEW_ASPECT_RATIO;
      let nextWidth = width;
      let nextHeight = widthLimitedHeight;

      // If height-limited, calculate based on available height
      if (widthLimitedHeight > height) {
        nextHeight = height;
        nextWidth = height * PREVIEW_ASPECT_RATIO;
      }

      // Clear previous timeout
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }

      // Debounce resize events (16ms ~= 60fps for smooth resizing)
      resizeTimeoutRef.current = window.setTimeout(() => {
        const canvasWidth = Math.max(1, Math.floor(nextWidth));
        const canvasHeight = Math.max(1, Math.floor(nextHeight));

        setCanvasSize((prev) =>
          prev.width === canvasWidth && prev.height === canvasHeight
            ? prev
            : { width: canvasWidth, height: canvasHeight },
        );

        // Only resize if dimensions actually changed
        if (
          lastSizeRef.current.width !== canvasWidth ||
          lastSizeRef.current.height !== canvasHeight
        ) {
          lastSizeRef.current = { width: canvasWidth, height: canvasHeight };
          onCanvasResize?.(canvasWidth, canvasHeight);
        }
      }, 16);
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-card/50">
      {/* Video area fills remaining height above the controls */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black px-6 pt-4 pb-2">
        <div
          ref={containerRef}
          className="relative flex h-full min-h-0 w-full max-h-full items-center justify-center"
        >
          <div className="flex h-full w-full items-center justify-center bg-black">
            <canvas
              ref={canvasRef}
              className="rounded-md bg-black"
              width={canvasSize.width}
              height={canvasSize.height}
              style={{
                display: "block",
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
                maxWidth: "100%",
                maxHeight: "100%",
              }}
            />
          </div>
        </div>
      </div>

      {/* Controls bar pinned to bottom of preview column */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-card/80">
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
