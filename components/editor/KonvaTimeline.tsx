"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Stage, Layer, Rect, Line, Text, Group } from "react-konva";
import type { Sequence, Clip, MediaAssetMeta } from "@/lib/editor/types";
import { formatTime } from "@/lib/editor/utils/time-format";
import { KonvaClipItem } from "./KonvaClipItem";

interface KonvaTimelineProps {
  sequence: Sequence;
  selectedClipId: string | null;
  currentTime: number;
  isPlaying: boolean;
  containerWidth: number;
  containerHeight?: number;
  assets: MediaAssetMeta[];
  onClipSelect: (clipId: string) => void;
  onClipMove: (clipId: string, newStart: number) => void;
  onClipReorder: (clips: Clip[]) => void;
  onClipTrim: (clipId: string, newTrimStart: number, newTrimEnd: number) => void;
  onSeek: (time: number) => void;
  onScrub?: (time: number) => void;
}

const CLIP_HEIGHT = 160;
const CLIP_Y = 20;
const TIMELINE_HEIGHT = 200;
const DEFAULT_TIMELINE_DURATION = 300; // 5 minutes default view
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const X_OFFSET = 10; // Padding from left edge
const MIN_CLIP_WIDTH = 40; // Minimum width in pixels to prevent slivers

export const KonvaTimeline = ({
  sequence,
  selectedClipId,
  currentTime,
  containerWidth,
  containerHeight = TIMELINE_HEIGHT,
  assets,
  onClipSelect,
  onClipMove,
  onClipReorder,
  onClipTrim,
  onSeek,
  onScrub,
}: KonvaTimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [scrubberTime, setScrubberTime] = useState(0);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [draggedClipX, setDraggedClipX] = useState<number>(0);
  const [virtualClipOrder, setVirtualClipOrder] = useState<Clip[]>([]);

  // Get first video track
  const videoTrack = sequence.tracks.find((t) => t.kind === "video");
  const clips = videoTrack?.clips ?? [];

  // Calculate effective duration
  const effectiveDuration = Math.max(
    sequence.duration || DEFAULT_TIMELINE_DURATION,
    DEFAULT_TIMELINE_DURATION,
  );

  // Smart default zoom based on content duration
  const calculateSmartZoom = useCallback(() => {
    if (sequence.duration <= 0) return 1.0;

    // Target: fill 70% of screen with actual content
    const targetViewDuration = sequence.duration / 0.7;
    const basePixelsPerSecond = containerWidth / DEFAULT_TIMELINE_DURATION;
    const smartZoom = (containerWidth / targetViewDuration) / basePixelsPerSecond;

    // Clamp between min and max zoom
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, smartZoom));
  }, [sequence.duration, containerWidth]);

  const [zoomLevel, setZoomLevel] = useState(() => calculateSmartZoom());

  // Update zoom when sequence duration changes
  useEffect(() => {
    setZoomLevel(calculateSmartZoom());
  }, [calculateSmartZoom]);

  // Dynamic pixels per second based on zoom
  const PIXELS_PER_SECOND =
    (containerWidth / DEFAULT_TIMELINE_DURATION) * zoomLevel;
  const TIMELINE_WIDTH = effectiveDuration * PIXELS_PER_SECOND + 50;

  // Time <-> Pixel conversion
  const timeToPixels = useCallback(
    (time: number) => time * PIXELS_PER_SECOND,
    [PIXELS_PER_SECOND],
  );
  const pixelsToTime = useCallback(
    (pixels: number) => pixels / PIXELS_PER_SECOND,
    [PIXELS_PER_SECOND],
  );

  // Zoom with Ctrl/Cmd + scroll wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const scrollLeft = containerRef.current.scrollLeft;

      const timeUnderCursor = pixelsToTime(mouseX + scrollLeft);

      const zoomDelta = -e.deltaY * 0.003;
      const newZoomLevel = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoomLevel + zoomDelta),
      );

      if (newZoomLevel !== zoomLevel) {
        setZoomLevel(newZoomLevel);

        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const newPixelsPerSecond =
            (containerWidth / DEFAULT_TIMELINE_DURATION) * newZoomLevel;
          const newPixelPosition = timeUnderCursor * newPixelsPerSecond;
          const newScrollLeft = newPixelPosition - mouseX;
          containerRef.current.scrollLeft = Math.max(0, newScrollLeft);
        });
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [zoomLevel, containerWidth, pixelsToTime]);

  // Handle timeline click for seeking
  const handleTimelineClick = (e: any) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPosition = stage.getPointerPosition();
    if (pointerPosition) {
      const clickedTime = pixelsToTime(pointerPosition.x - X_OFFSET);
      const clampedTime = Math.max(0, Math.min(effectiveDuration, clickedTime));
      onSeek(clampedTime);
    }
  };

  // Handle timeline mouse move for scrubbing
  const handleTimelineMouseMove = (e: any) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPosition = stage.getPointerPosition();
    if (pointerPosition) {
      const hoveredTime = pixelsToTime(pointerPosition.x - X_OFFSET);
      const clampedTime = Math.max(0, Math.min(effectiveDuration, hoveredTime));

      setScrubberTime(clampedTime);
      setIsHovering(true);

      if (onScrub) {
        onScrub(clampedTime);
      }
    }
  };

  const handleTimelineMouseLeave = () => {
    setIsHovering(false);
  };

  // Clip drag handlers
  const handleClipDragStart = (clipId: string, startX: number) => {
    setDraggingClipId(clipId);
    setDraggedClipX(startX);
    setVirtualClipOrder([...clips]);
  };

  const handleClipDragMove = (clipId: string, currentX: number) => {
    setDraggedClipX(currentX);

    const draggedClip = virtualClipOrder.find((c) => c.id === clipId);
    if (!draggedClip) return;

    const draggedClipCenter =
      currentX + (draggedClip.duration * PIXELS_PER_SECOND) / 2;
    const otherClips = virtualClipOrder.filter((c) => c.id !== clipId);
    const newOrder = [...otherClips];

    let insertIndex = 0;
    let cumulativeTime = 0;

    for (let i = 0; i < otherClips.length; i++) {
      const clip = otherClips[i];
      const clipStart = cumulativeTime * PIXELS_PER_SECOND;
      const clipEnd = clipStart + clip.duration * PIXELS_PER_SECOND;
      const clipCenter = (clipStart + clipEnd) / 2;

      if (draggedClipCenter > clipCenter) {
        insertIndex = i + 1;
      }

      cumulativeTime += clip.duration;
    }

    newOrder.splice(insertIndex, 0, draggedClip);
    setVirtualClipOrder(newOrder);
  };

  const handleClipDragEnd = (clipId: string) => {
    if (!draggingClipId) return;

    // Reflow clips to be sequential
    let cumulativeTime = 0;
    const reorderedClips = virtualClipOrder.map((clip) => {
      const reflowedClip = { ...clip, start: cumulativeTime };
      cumulativeTime += clip.duration;
      return reflowedClip;
    });

    onClipReorder(reorderedClips);

    setDraggingClipId(null);
    setDraggedClipX(0);
    setVirtualClipOrder([]);
  };

  // Render clips
  const clipsToRender = draggingClipId ? virtualClipOrder : clips;

  return (
    <div className="relative w-full h-full flex flex-col border-t border-border bg-background">
      {/* Time ruler */}
      <div className="flex-none h-8 bg-muted/30 border-b border-border relative overflow-x-auto scrollbar-hide">
        <div style={{ width: `${TIMELINE_WIDTH}px`, height: "100%" }}>
          {(() => {
            // Adaptive marker interval based on zoom and duration
            const getMarkerInterval = () => {
              const visibleDuration = containerWidth / PIXELS_PER_SECOND;

              if (visibleDuration <= 30) return 1; // 1s for very zoomed in
              if (visibleDuration <= 60) return 5; // 5s for medium zoom
              if (visibleDuration <= 180) return 10; // 10s for normal
              if (visibleDuration <= 600) return 30; // 30s for zoomed out
              return 60; // 60s for very zoomed out
            };

            const interval = getMarkerInterval();
            const markers = [];

            for (let time = 0; time <= effectiveDuration; time += interval) {
              const x = timeToPixels(time) + X_OFFSET;
              markers.push(
                <div
                  key={time}
                  className="absolute text-xs text-muted-foreground"
                  style={{ left: `${x}px`, top: "2px" }}
                >
                  {formatTime(time)}
                </div>
              );
            }

            return markers;
          })()}
        </div>
      </div>

      {/* Canvas timeline */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden flex-1"
        style={{ height: `${containerHeight}px` }}
      >
        <Stage
          width={TIMELINE_WIDTH}
          height={containerHeight}
          onMouseMove={handleTimelineMouseMove}
          onMouseLeave={handleTimelineMouseLeave}
        >
          <Layer>
            {/* Background */}
            <Rect
              x={0}
              y={0}
              width={TIMELINE_WIDTH}
              height={containerHeight}
              fill="#1a1a1a"
              onClick={handleTimelineClick}
            />

            {/* Timeline track */}
            <Rect
              x={X_OFFSET}
              y={CLIP_Y}
              width={TIMELINE_WIDTH - X_OFFSET * 2}
              height={CLIP_HEIGHT}
              fill="#000000"
              cornerRadius={4}
            />

            {/* Clips */}
            {clipsToRender.map((clip) => {
              const isDragging = clip.id === draggingClipId;
              const asset = assets.find((a) => a.id === clip.mediaId);
              return (
                <KonvaClipItem
                  key={clip.id}
                  clip={clip}
                  asset={asset}
                  isSelected={clip.id === selectedClipId}
                  isDragging={isDragging}
                  dragX={isDragging ? draggedClipX : undefined}
                  pixelsPerSecond={PIXELS_PER_SECOND}
                  xOffset={X_OFFSET}
                  onSelect={() => onClipSelect(clip.id)}
                  onDragStart={(startX) => handleClipDragStart(clip.id, startX)}
                  onDragMove={(currentX) => handleClipDragMove(clip.id, currentX)}
                  onDragEnd={() => handleClipDragEnd(clip.id)}
                  onTrim={(newTrimStart, newTrimEnd) =>
                    onClipTrim(clip.id, newTrimStart, newTrimEnd)
                  }
                />
              );
            })}

            {/* Scrubber line (red - hover preview) */}
            {isHovering && (
              <Line
                points={[
                  timeToPixels(scrubberTime) + X_OFFSET,
                  0,
                  timeToPixels(scrubberTime) + X_OFFSET,
                  containerHeight,
                ]}
                stroke="#EF4444"
                strokeWidth={2}
                listening={false}
              />
            )}

            {/* Playhead (white - actual position) */}
            <Line
              points={[
                timeToPixels(currentTime) + X_OFFSET,
                0,
                timeToPixels(currentTime) + X_OFFSET,
                containerHeight,
              ]}
              stroke="#FFFFFF"
              strokeWidth={2}
              listening={false}
            />
          </Layer>
        </Stage>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        {Math.round(zoomLevel * 100)}%
      </div>
    </div>
  );
};
