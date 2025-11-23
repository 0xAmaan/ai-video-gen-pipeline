"use client";

import type { Clip, Track } from "@/lib/remotion/timelineStore";
import { useMemo, useRef, useState } from "react";

interface Props {
  tracks: Track[];
  fps: number;
  durationInFrames: number;
  currentFrame: number;
  onSeek: (frame: number) => void;
  onSelectClip?: (clipId: string) => void;
}

const trackHeight = 32;
const trackGap = 8;
const containerPadding = 12;

export const TimelineBar = ({ tracks, fps, durationInFrames, currentFrame, onSeek, onSelectClip }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setDragging] = useState(false);

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const frame = Math.round(pct * durationInFrames);
    onSeek(frame);
  };

  const playheadLeft = useMemo(() => {
    if (!containerRef.current || durationInFrames <= 0) return 0;
    const width = containerRef.current.clientWidth;
    return Math.max(0, Math.min(width, (currentFrame / durationInFrames) * width));
  }, [currentFrame, durationInFrames]);

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
        style={{ padding: `${containerPadding}px`, minHeight: tracks.length * (trackHeight + trackGap) + trackGap }}
        onMouseDown={(e) => {
          setDragging(true);
          handleSeekClick(e);
        }}
        onMouseMove={(e) => {
          if (isDragging) {
            handleSeekClick(e);
          }
        }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-primary"
          style={{ left: playheadLeft + containerPadding }}
        />

        {/* Tracks & clips */}
        {tracks.map((track, tIndex) => {
          const y =
            containerPadding + tIndex * (trackHeight + trackGap);
          return (
            <div key={track.id} className="relative" style={{ height: trackHeight, top: y, position: "absolute", left: containerPadding, right: containerPadding }}>
              {track.clips.map((clip) => {
                const left = (clip.startFrame / durationInFrames) * 100;
                const width = (clip.durationInFrames / durationInFrames) * 100;
                return (
                  <div
                    key={clip.id}
                    className="absolute h-full rounded bg-primary/70 text-[11px] text-primary-foreground px-2 flex items-center overflow-hidden cursor-pointer"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip?.(clip.id);
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
