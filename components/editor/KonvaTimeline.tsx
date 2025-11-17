"use client";

import { useRef, useState, useEffect, useCallback, useMemo, memo } from "react";
import { Stage, Layer, Rect, Line, Text, Group } from "react-konva";
import { ChevronsDown } from "lucide-react";
import type { Sequence, Clip, MediaAssetMeta } from "@/lib/editor/types";
import { formatTime } from "@/lib/editor/utils/time-format";
import { KonvaClipItem } from "./KonvaClipItem";
import type Konva from "konva";
import { snapTimeToBeatMarkers } from "@/lib/editor/audio-beat-helpers";
import type { BeatMarker } from "@/types/audio";

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
  onClipTrim: (
    clipId: string,
    newTrimStart: number,
    newTrimEnd: number,
  ) => void;
  onSeek: (time: number) => void;
  onScrub?: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  beatMarkers?: BeatMarker[];
  snapToBeats?: boolean;
  magneticSnapEnabled?: boolean; // Enable magnetic snapping to clip edges/playhead
  magneticSnapThreshold?: number; // Snap distance threshold in seconds (default: 0.1)
}

const CLIP_HEIGHT = 120;
const CLIP_Y = 94;
const TIMELINE_HEIGHT = 200;
const DEFAULT_TIMELINE_DURATION = 300; // 5 minutes default view
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const X_OFFSET = 10; // Padding from left edge
const MIN_CLIP_WIDTH = 40; // Minimum width in pixels to prevent slivers
const AUDIO_TRACK_HEIGHT = 60;
const AUDIO_TRACK_GAP = 30;
const AUDIO_CLIP_COLOR = "#4F46E5";
const AUDIO_TRACK_LABEL_COLOR = "#9CA3AF";
const AUDIO_TRACK_BG = "#0b0b0b";
const AUDIO_WAVEFORM_COLOR = "#A5B4FC";
const AUDIO_VOLUME_COLOR = "#FBBF24";
const AUDIO_TRACK_Y = CLIP_Y + CLIP_HEIGHT + 20;

const generateWaveformPoints = (
  waveform: Float32Array,
  xStart: number,
  yCenter: number,
  width: number,
  height: number,
): number[] => {
  const points: number[] = [];
  if (!Number.isFinite(width) || width <= 0) return points;

  const samples = waveform.length;
  if (!samples) return points;

  const steps = Math.max(1, Math.floor(width));
  const halfHeight = height / 2;

  for (let i = 0; i < steps; i++) {
    const ratio = i / steps;
    const sampleIndex = Math.min(
      Math.floor(ratio * samples),
      Math.max(0, samples - 1),
    );
    const amplitude = waveform[sampleIndex] || 0;
    const x = xStart + i;
    const y = yCenter - amplitude * halfHeight;
    points.push(x, y);
  }

  return points;
};

const KonvaTimelineComponent = ({
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
  onScrubStart,
  onScrubEnd,
  beatMarkers = [],
  snapToBeats = false,
  magneticSnapEnabled = true,
  magneticSnapThreshold = 0.1, // Default 100ms snap threshold
}: KonvaTimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playheadLineRef = useRef<Konva.Line>(null);
  const playheadChevronRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [scrubberTime, setScrubberTime] = useState(0);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [draggedClipX, setDraggedClipX] = useState<number>(0);
  const [virtualClipOrder, setVirtualClipOrder] = useState<Clip[]>([]);
  const [snapGuides, setSnapGuides] = useState<number[]>([]); // Array of time positions for snap guides
  const scrubRafRef = useRef<number | null>(null);
  const pendingScrubTimeRef = useRef<number | null>(null);
  const isScrubbing = useRef(false);

  // Get first video track
  const videoTrack = sequence.tracks.find((t) => t.kind === "video");
  const audioTrack = sequence.tracks.find((t) => t.kind === "audio");
  const clips = videoTrack?.clips ?? [];
  const audioClips = audioTrack?.clips ?? [];
  const hasAudioTrack = audioClips.length > 0;
  const snapEnabled = snapToBeats && beatMarkers.length > 0;

  // Create asset lookup Map for O(1) access instead of O(n) find
  const assetMap = useMemo(() => {
    const map = new Map<string, MediaAssetMeta>();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);

  // Calculate effective duration
  const effectiveDuration = Math.max(
    sequence.duration || DEFAULT_TIMELINE_DURATION,
    DEFAULT_TIMELINE_DURATION,
  );
  const visibleBeatMarkers = useMemo(
    () =>
      beatMarkers.filter(
        (marker) => marker.time >= 0 && marker.time <= effectiveDuration + 1,
      ),
    [beatMarkers, effectiveDuration],
  );

  // Smart default zoom based on content duration
  const calculateSmartZoom = useCallback(() => {
    if (sequence.duration <= 0) return 1.0;

    // Target: fill 70% of screen with actual content
    const targetViewDuration = sequence.duration / 0.7;
    const basePixelsPerSecond = containerWidth / DEFAULT_TIMELINE_DURATION;
    const smartZoom = containerWidth / targetViewDuration / basePixelsPerSecond;

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
  const timelineHeight =
    containerHeight + (hasAudioTrack ? AUDIO_TRACK_HEIGHT + AUDIO_TRACK_GAP : 0);
  const snapTime = useCallback(
    (value: number) =>
      snapEnabled ? snapTimeToBeatMarkers(value, beatMarkers) : value,
    [snapEnabled, beatMarkers],
  );

  // Time <-> Pixel conversion
  const timeToPixels = useCallback(
    (time: number) => time * PIXELS_PER_SECOND,
    [PIXELS_PER_SECOND],
  );
  const pixelsToTime = useCallback(
    (pixels: number) => pixels / PIXELS_PER_SECOND,
    [PIXELS_PER_SECOND],
  );

  // Update playhead position directly via ref to avoid 60fps re-renders
  // Use RAF to throttle updates and prevent excessive canvas redraws
  useEffect(() => {
    let rafId: number;

    const updatePlayhead = () => {
      if (playheadLineRef.current) {
        const xPos = timeToPixels(currentTime) + X_OFFSET;
        playheadLineRef.current.points([xPos, 0, xPos, timelineHeight]);
        playheadLineRef.current.getLayer()?.batchDraw();
      }

      // Update HTML chevron position
      if (playheadChevronRef.current) {
        const xPos = timeToPixels(currentTime) + X_OFFSET;
        playheadChevronRef.current.style.left = `${xPos}px`;
      }
    };

    rafId = requestAnimationFrame(updatePlayhead);
    return () => cancelAnimationFrame(rafId);
  }, [currentTime, timeToPixels, timelineHeight]);

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
      const snappedTime = snapTime(clampedTime);
      onSeek(snappedTime);
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
      const snappedTime = snapTime(clampedTime);

      setScrubberTime(snappedTime);
      setIsHovering(true);

      // Signal scrub start on first hover
      if (!isScrubbing.current && onScrubStart) {
        isScrubbing.current = true;
        onScrubStart();
      }

      // Throttle scrub calls using requestAnimationFrame
      if (onScrub) {
        pendingScrubTimeRef.current = snappedTime;

        if (scrubRafRef.current === null) {
          scrubRafRef.current = requestAnimationFrame(() => {
            if (pendingScrubTimeRef.current !== null) {
              onScrub(pendingScrubTimeRef.current);
              pendingScrubTimeRef.current = null;
            }
            scrubRafRef.current = null;
          });
        }
      }
    }
  };

  const handleTimelineMouseLeave = () => {
    setIsHovering(false);

    // Signal scrub end
    if (isScrubbing.current && onScrubEnd) {
      isScrubbing.current = false;
      onScrubEnd();
    }

    // Cancel any pending scrub on mouse leave
    if (scrubRafRef.current !== null) {
      cancelAnimationFrame(scrubRafRef.current);
      scrubRafRef.current = null;
      pendingScrubTimeRef.current = null;
    }
  };

  // Calculate snap points for magnetic snapping
  const calculateSnapPoints = useCallback(
    (draggedClipId: string, draggedClipTime: number, draggedClipDuration: number) => {
      if (!magneticSnapEnabled) {
        setSnapGuides([]);
        return draggedClipTime;
      }

      const snapPoints: Array<{ time: number; type: string }> = [];

      // Add playhead as snap point
      snapPoints.push({ time: currentTime, type: "playhead" });

      // Add all other clip edges as snap points
      clips.forEach((clip) => {
        if (clip.id === draggedClipId) return; // Skip the dragged clip

        // Clip start
        snapPoints.push({ time: clip.start, type: "clip-start" });
        // Clip end
        snapPoints.push({ time: clip.start + clip.duration, type: "clip-end" });
      });

      // Check both start and end of dragged clip for snapping
      const draggedStart = draggedClipTime;
      const draggedEnd = draggedClipTime + draggedClipDuration;

      let bestSnapPoint: { time: number; offset: number } | null = null;
      let minDistance = magneticSnapThreshold;

      for (const snapPoint of snapPoints) {
        // Check if dragged clip START is close to snap point
        const distanceToStart = Math.abs(draggedStart - snapPoint.time);
        if (distanceToStart < minDistance) {
          minDistance = distanceToStart;
          bestSnapPoint = { time: snapPoint.time, offset: 0 }; // Snap start to point
        }

        // Check if dragged clip END is close to snap point
        const distanceToEnd = Math.abs(draggedEnd - snapPoint.time);
        if (distanceToEnd < minDistance) {
          minDistance = distanceToEnd;
          bestSnapPoint = { time: snapPoint.time, offset: -draggedClipDuration }; // Snap end to point
        }
      }

      if (bestSnapPoint) {
        // Show snap guide at the snap point
        setSnapGuides([bestSnapPoint.time]);
        // Return snapped time
        return bestSnapPoint.time + bestSnapPoint.offset;
      }

      // No snap, clear guides
      setSnapGuides([]);
      return draggedClipTime;
    },
    [magneticSnapEnabled, magneticSnapThreshold, currentTime, clips],
  );

  // Clip drag handlers - memoized to prevent child re-renders
  const handleClipDragStart = useCallback(
    (clipId: string, startX: number) => {
      setDraggingClipId(clipId);
      setDraggedClipX(startX);
      setVirtualClipOrder((prev) => [...clips]);
    },
    [clips],
  );

  const handleClipDragMove = useCallback(
    (clipId: string, currentX: number) => {
      const draggedClip = clips.find((c) => c.id === clipId);
      if (draggedClip) {
        // Convert pixel position to time
        const dragTime = pixelsToTime(currentX);

        // Apply snap logic if enabled
        const snappedTime = calculateSnapPoints(
          clipId,
          dragTime,
          draggedClip.duration
        );

        // Convert back to pixels for rendering
        const snappedX = timeToPixels(snappedTime);
        setDraggedClipX(snappedX);
      } else {
        setDraggedClipX(currentX);
      }

      setVirtualClipOrder((prevOrder) => {
        const draggedClip = prevOrder.find((c) => c.id === clipId);
        if (!draggedClip) return prevOrder;

        const draggedClipCenter =
          currentX + (draggedClip.duration * PIXELS_PER_SECOND) / 2;
        const otherClips = prevOrder.filter((c) => c.id !== clipId);
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
        return newOrder;
      });
    },
    [PIXELS_PER_SECOND, clips, pixelsToTime, timeToPixels, calculateSnapPoints],
  );

  const handleClipDragEnd = useCallback(
    (clipId: string) => {
      // Calculate reordered clips outside of setState
      let reorderedClips: Clip[] = [];
      setVirtualClipOrder((prevOrder) => {
        if (!draggingClipId) return prevOrder;

        // Reflow clips to be sequential
        let cumulativeTime = 0;
        reorderedClips = prevOrder.map((clip) => {
          const reflowedClip = { ...clip, start: cumulativeTime };
          cumulativeTime += clip.duration;
          return reflowedClip;
        });

        return prevOrder;
      });

      // Call onClipReorder outside of setState to avoid update-during-render error
      if (reorderedClips.length > 0) {
        onClipReorder(reorderedClips);
      }

      setDraggingClipId(null);
      setDraggedClipX(0);
      setVirtualClipOrder([]);
      setSnapGuides([]); // Clear snap guides when drag ends
    },
    [draggingClipId, onClipReorder],
  );

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
                </div>,
              );
            }

            return markers;
          })()}

          {/* Playhead chevron indicator */}
          <div
            ref={playheadChevronRef}
            className="absolute pointer-events-none"
            style={{
              left: `${timeToPixels(currentTime) + X_OFFSET}px`,
              bottom: "0px",
              transform: "translateX(-50%)",
            }}
          >
            <ChevronsDown className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* Canvas timeline */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden flex-1"
        style={{ height: `${timelineHeight}px` }}
      >
        <Stage
          key="konva-timeline-stage"
          width={TIMELINE_WIDTH}
          height={timelineHeight}
          onMouseMove={handleTimelineMouseMove}
          onMouseLeave={handleTimelineMouseLeave}
        >
          <Layer>
            {/* Background */}
            <Rect
              x={0}
              y={0}
              width={TIMELINE_WIDTH}
              height={timelineHeight}
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

            {/* Audio track */}
            {hasAudioTrack && (
              <>
                <Rect
                  x={X_OFFSET}
                  y={AUDIO_TRACK_Y}
                  width={TIMELINE_WIDTH - X_OFFSET * 2}
                  height={AUDIO_TRACK_HEIGHT}
                  fill={AUDIO_TRACK_BG}
                  cornerRadius={4}
                />
                <Text
                  x={X_OFFSET + 8}
                  y={AUDIO_TRACK_Y - 18}
                  text="Audio Track"
                  fontSize={12}
                  fill={AUDIO_TRACK_LABEL_COLOR}
                />

                {audioClips.map((clip) => {
                  const asset = assetMap.get(clip.mediaId);
                  const clipStartX = timeToPixels(clip.start) + X_OFFSET;
                  const clipWidth = Math.max(
                    MIN_CLIP_WIDTH,
                    clip.duration * PIXELS_PER_SECOND,
                  );
                  const isSelected = clip.id === selectedClipId;
                  const waveformPoints =
                    asset?.waveform && clipWidth >= 10
                      ? generateWaveformPoints(
                          asset.waveform,
                          clipStartX,
                          AUDIO_TRACK_Y + AUDIO_TRACK_HEIGHT / 2,
                          clipWidth,
                          AUDIO_TRACK_HEIGHT - 16,
                        )
                      : null;

                  return (
                    <Group key={clip.id}>
                      <Rect
                        x={clipStartX}
                        y={AUDIO_TRACK_Y + 4}
                        width={clipWidth}
                        height={AUDIO_TRACK_HEIGHT - 8}
                        fill={AUDIO_CLIP_COLOR}
                        opacity={0.85}
                        cornerRadius={4}
                        stroke={isSelected ? "#FFFFFF" : "#6366F1"}
                        strokeWidth={isSelected ? 2 : 1}
                        onClick={() => onClipSelect(clip.id)}
                      />
                      {waveformPoints && waveformPoints.length > 0 && (
                        <Line
                          points={waveformPoints}
                          stroke={AUDIO_WAVEFORM_COLOR}
                          strokeWidth={1}
                          tension={0.3}
                          listening={false}
                        />
                      )}
                      <Text
                        x={clipStartX + 6}
                        y={AUDIO_TRACK_Y + 8}
                        text={asset?.name || "Audio"}
                        fontSize={10}
                        fill="#FFFFFF"
                        width={clipWidth - 12}
                        ellipsis
                        listening={false}
                      />
                      <Text
                        x={clipStartX + 6}
                        y={AUDIO_TRACK_Y + AUDIO_TRACK_HEIGHT - 22}
                        text={`${clip.duration.toFixed(1)}s`}
                        fontSize={9}
                        fill="#C7D2FE"
                        listening={false}
                      />
                      {clip.volume !== undefined && clip.volume !== 1 && (
                        <Text
                          x={clipStartX + clipWidth - 34}
                          y={AUDIO_TRACK_Y + 8}
                          text={`${Math.round((clip.volume ?? 1) * 100)}%`}
                          fontSize={9}
                          fill={AUDIO_VOLUME_COLOR}
                          listening={false}
                        />
                      )}
                    </Group>
                  );
                })}
              </>
            )}

            {/* Beat markers */}
            {visibleBeatMarkers.map((beat, index) => {
              const x = timeToPixels(beat.time) + X_OFFSET;
              const isStrong =
                typeof beat.strength === "number"
                  ? beat.strength >= 0.75
                  : index % 4 === 0;
              return (
                <Line
                  key={`beat-${index}`}
                  points={[x, 0, x, timelineHeight]}
                  stroke={isStrong ? "#10B981" : "rgba(16,185,129,0.4)"}
                  strokeWidth={isStrong ? 1.5 : 1}
                  dash={isStrong ? [] : [4, 6]}
                  listening={false}
                />
              );
            })}

            {/* Clips */}
            {clipsToRender.map((clip) => {
              const isDragging = clip.id === draggingClipId;
              const asset = assetMap.get(clip.mediaId);
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
                  onDragMove={(currentX) =>
                    handleClipDragMove(clip.id, currentX)
                  }
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
                  timelineHeight,
                ]}
                stroke="#EF4444"
                strokeWidth={2}
                listening={false}
              />
            )}

            {/* Magnetic snap guide lines (cyan - shown during drag) */}
            {snapGuides.map((snapTime, index) => (
              <Line
                key={`snap-guide-${index}`}
                points={[
                  timeToPixels(snapTime) + X_OFFSET,
                  0,
                  timeToPixels(snapTime) + X_OFFSET,
                  timelineHeight,
                ]}
                stroke="#00D9FF"
                strokeWidth={2}
                opacity={0.7}
                dash={[10, 5]} // Dashed line to distinguish from playhead
                listening={false}
              />
            ))}

            {/* Playhead (white - actual position) - updated via ref */}
            <Line
              ref={playheadLineRef}
              points={[
                timeToPixels(currentTime) + X_OFFSET,
                0,
                timeToPixels(currentTime) + X_OFFSET,
                timelineHeight,
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

// Memoize the component to prevent re-renders when props haven't changed
export const KonvaTimeline = memo(KonvaTimelineComponent);
