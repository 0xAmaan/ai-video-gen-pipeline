"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Clip, Track } from "@/lib/remotion/timelineStore";

type DragMode = "move" | "resize-left" | "resize-right" | null;
const SNAP_STEP_FRAMES = 5; // snap every 5 frames (~166ms at 30fps)

interface Props {
  tracks: Track[];
  fps: number;
  durationInFrames: number;
  currentFrame: number;
  selectedClipId: string | null;
  onSeek: (frame: number) => void;
  onSelectClip?: (clipId: string) => void;
  onUpdateClip?: (clipId: string, updates: Partial<Clip>) => void;
}

const trackHeight = 32;
const trackGap = 8;
const containerPadding = 12;
const resizeHandleWidth = 6;

export const DraggableTimelineBar = ({
  tracks,
  fps,
  durationInFrames,
  currentFrame,
  selectedClipId,
  onSeek,
  onSelectClip,
  onUpdateClip,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setDraggingPlayhead] = useState(false);
  const [dragState, setDragState] = useState<{
    clipId: string;
    mode: DragMode;
    startFrame: number;
    initialStart: number;
    initialDuration: number;
  } | null>(null);

  const playheadLeft = useMemo(() => {
    if (!containerRef.current || durationInFrames <= 0) return 0;
    const width = containerRef.current.clientWidth - containerPadding * 2;
    return Math.max(0, Math.min(width, (currentFrame / durationInFrames) * width));
  }, [currentFrame, durationInFrames]);

  const frameFromClientX = (clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left - containerPadding;
    const pct = Math.max(0, Math.min(1, x / (rect.width - containerPadding * 2)));
    const frame = Math.round(pct * durationInFrames);
    return Math.round(frame / SNAP_STEP_FRAMES) * SNAP_STEP_FRAMES;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingPlayhead) {
      onSeek(frameFromClientX(e.clientX));
      return;
    }
    if (dragState) {
      const delta = frameFromClientX(e.clientX) - dragState.startFrame;
      const { mode, clipId, initialStart, initialDuration } = dragState;
      if (!onUpdateClip) return;

      if (mode === "move") {
        const nextStart = Math.max(0, Math.round((initialStart + delta) / SNAP_STEP_FRAMES) * SNAP_STEP_FRAMES);
        onUpdateClip(clipId, { startFrame: nextStart });
      } else if (mode === "resize-left") {
        const newStart = Math.max(0, Math.round((initialStart + delta) / SNAP_STEP_FRAMES) * SNAP_STEP_FRAMES);
        const newDuration = Math.max(1, Math.round((initialDuration - delta) / SNAP_STEP_FRAMES) * SNAP_STEP_FRAMES);
        onUpdateClip(clipId, { startFrame: newStart, durationInFrames: newDuration });
      } else if (mode === "resize-right") {
        const newDuration = Math.max(1, Math.round((initialDuration + delta) / SNAP_STEP_FRAMES) * SNAP_STEP_FRAMES);
        onUpdateClip(clipId, { durationInFrames: newDuration });
      }
    }
  };

  const handleMouseUp = () => {
    setDraggingPlayhead(false);
    setDragState(null);
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  });

  return (
    <div className="border border-border rounded-lg bg-card p-3">
      <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
        <span>Timeline</span>
        <span>
          {currentFrame}f / {durationInFrames}f ({(currentFrame / fps).toFixed(2)}s)
        </span>
      </div>
      <div
        ref={containerRef}
        className="relative w-full border border-border/60 rounded bg-muted/30"
        style={{
          padding: `${containerPadding}px`,
          minHeight: tracks.length * (trackHeight + trackGap) + trackGap,
        }}
        onMouseDown={(e) => {
    setDraggingPlayhead(true);
    onSeek(frameFromClientX(e.clientX));
  }}
>
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-primary"
          style={{ left: playheadLeft + containerPadding }}
        />

        {/* Tracks & clips */}
        {tracks.map((track, tIndex) => {
          const y = containerPadding + tIndex * (trackHeight + trackGap);
          return (
            <div
              key={track.id}
              className="relative"
              style={{
                height: trackHeight,
                top: y,
                position: "absolute",
                left: containerPadding,
                right: containerPadding,
              }}
            >
              {track.clips.map((clip) => {
                const left = (clip.startFrame / durationInFrames) * 100;
                const width = (clip.durationInFrames / durationInFrames) * 100;
                const isSelected = selectedClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    className={`absolute h-full rounded text-[11px] px-2 flex items-center overflow-hidden cursor-pointer ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-primary/60 text-primary-foreground"
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onSelectClip?.(clip.id);
                      // Determine drag mode based on cursor position
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const offsetX = e.clientX - rect.left;
                      if (offsetX < resizeHandleWidth) {
                        setDragState({
                          clipId: clip.id,
                          mode: "resize-left",
                          startFrame: frameFromClientX(e.clientX),
                          initialStart: clip.startFrame,
                          initialDuration: clip.durationInFrames,
                        });
                      } else if (offsetX > rect.width - resizeHandleWidth) {
                        setDragState({
                          clipId: clip.id,
                          mode: "resize-right",
                          startFrame: frameFromClientX(e.clientX),
                          initialStart: clip.startFrame,
                          initialDuration: clip.durationInFrames,
                        });
                      } else {
                        setDragState({
                          clipId: clip.id,
                          mode: "move",
                          startFrame: frameFromClientX(e.clientX),
                          initialStart: clip.startFrame,
                          initialDuration: clip.durationInFrames,
                        });
                      }
                    }}
                    title={`${clip.name ?? clip.id} • ${clip.durationInFrames}f`}
                  >
                    <span className="truncate">{clip.name ?? clip.id}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
