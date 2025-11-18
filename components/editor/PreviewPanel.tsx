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
  timelineHeight?: number;
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
  timelineHeight = 340,
}: PreviewPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });

  // Calculate available height based on window and timeline height
  const getAvailableHeight = useCallback(() => {
    // When timeline is large, we need to be more aggressive about constraining
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const estimatedUIOverhead = 200; // Top bar + resize handle + padding + controls
    const maxCanvasHeight = windowHeight - timelineHeight - estimatedUIOverhead;
    
    // Ensure reasonable bounds
    return Math.max(150, Math.min(720, maxCanvasHeight));
  }, [timelineHeight]);

  // Debounced resize handler
  const handleResize = useCallback(
    (entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (!entry) return;

      const { width } = entry.contentRect;
      if (width <= 0) return;

      // Use available height calculation instead of container height
      const availableHeight = getAvailableHeight();
      const widthLimitedHeight = width / PREVIEW_ASPECT_RATIO;
      let nextWidth = width;
      let nextHeight = widthLimitedHeight;

      if (widthLimitedHeight > availableHeight) {
        nextHeight = availableHeight;
        nextWidth = availableHeight * PREVIEW_ASPECT_RATIO;
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
    [onCanvasResize, getAvailableHeight],
  );

  // Setup ResizeObserver and timeline height monitoring
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize]);

  // Trigger resize when timeline height changes
  useEffect(() => {
    if (!containerRef.current || !onCanvasResize) return;
    
    // Simulate a resize entry to trigger recalculation
    const entry = {
      contentRect: containerRef.current.getBoundingClientRect(),
    } as ResizeObserverEntry;
    
    handleResize([entry]);
  }, [timelineHeight, handleResize, onCanvasResize]);

  return (
    <div className="flex h-full flex-col gap-3 border-r border-border bg-card/50 p-4">
      {/* Canvas container - renderer handles aspect ratio + padding */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden bg-black"
        style={{
          maxHeight: `calc(100vh - ${timelineHeight + 180}px)`
        }}
      >
        <canvas
          ref={canvasRef}
          className="rounded-md"
          width={canvasSize.width}
          height={canvasSize.height}
          style={{
            display: "block",
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
          }}
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
