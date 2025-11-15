"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Sequence, TimelineSelection, Track } from "@/lib/editor/types";

const BASE_SCALE = 120; // px per second at zoom 1

type DragMode = "move" | "trim-start" | "trim-end";

interface TimelineProps {
  sequence: Sequence;
  selection: TimelineSelection;
  zoom: number;
  snap: boolean;
  currentTime: number;
  onSelectionChange: (clipId: string) => void;
  onMoveClip: (clipId: string, trackId: string, start: number) => void;
  onTrimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
  onSeek: (time: number) => void;
  onZoomChange: (zoom: number) => void;
}

export const Timeline = ({
  sequence,
  selection,
  zoom,
  snap,
  currentTime,
  onSelectionChange,
  onMoveClip,
  onTrimClip,
  onSeek,
  onZoomChange,
}: TimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ start: 0, end: 10 });
  const scale = useMemo(() => BASE_SCALE * zoom, [zoom]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handle = () => {
      const start = element.scrollLeft / scale;
      const end = start + element.clientWidth / scale;
      setViewport({ start, end });
    };
    handle();
    element.addEventListener("scroll", handle);
    return () => element.removeEventListener("scroll", handle);
  }, [scale]);

  const clips = useMemo(() => (
    sequence.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter(
        (clip) =>
          clip.start + clip.duration > viewport.start - 2 && clip.start < viewport.end + 2,
      ),
    }))
  ), [sequence.tracks, viewport.end, viewport.start]);

  const handlePointer = (
    track: Track,
    clipId: string,
    mode: DragMode,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const initialX = event.clientX;
    const initialStart = clip.start;
    const initialDuration = clip.duration;

    const move = (pointerEvent: PointerEvent) => {
      const deltaPx = pointerEvent.clientX - initialX;
      const deltaSeconds = deltaPx / scale;
      if (mode === "move") {
        const snapped = snapTime(initialStart + deltaSeconds, snap);
        onMoveClip(clip.id, track.id, Math.max(0, snapped));
      } else if (mode === "trim-start") {
        const delta = snapTime(deltaSeconds, snap);
        if (delta < clip.duration - 0.1) {
          onTrimClip(clip.id, delta, 0);
        }
      } else if (mode === "trim-end") {
        const delta = -snapTime(deltaSeconds, snap);
        if (delta < initialDuration - 0.1) {
          onTrimClip(clip.id, 0, delta);
        }
      }
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  return (
    <div className="flex h-full min-h-[280px] flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span>Zoom</span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(event) => onZoomChange(parseFloat(event.target.value))}
          />
        </div>
        <div>Snap {snap ? "On" : "Off"}</div>
      </div>
      <div className="relative border-b border-border bg-muted/30">
        <TimeRuler duration={sequence.duration} scale={scale} onSeek={onSeek} />
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-primary"
          style={{ left: `${currentTime * scale}px` }}
        />
      </div>
      <div ref={containerRef} className="relative flex-1 overflow-x-auto bg-background">
        <div className="min-h-full" style={{ width: `${Math.max(sequence.duration * scale, 2000)}px` }}>
          {clips.map((track) => (
            <div key={track.id} className="border-b border-border py-3">
              <p className="px-2 text-xs font-semibold uppercase text-muted-foreground">{track.id}</p>
              <div className="relative h-16">
                {track.clips.map((clip) => (
                  <div
                    key={clip.id}
                    className={`absolute h-14 cursor-move rounded-md border px-2 py-1 text-xs ${
                      selection.clipIds.includes(clip.id)
                        ? "border-primary bg-primary/30"
                        : "border-border bg-card"
                    }`}
                    style={{
                      left: `${clip.start * scale}px`,
                      width: `${Math.max(clip.duration * scale, 4)}px`,
                    }}
                    onPointerDown={(event) => handlePointer(track as Track, clip.id, "move", event)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectionChange(clip.id);
                    }}
                  >
                    <div className="flex justify-between text-[11px]">
                      <span>{clip.id}</span>
                      <span>{clip.duration.toFixed(2)}s</span>
                    </div>
                    <div
                      className="absolute inset-y-1 left-0 w-1 cursor-ew-resize rounded-full bg-primary/80"
                      onPointerDown={(event) => handlePointer(track as Track, clip.id, "trim-start", event)}
                    />
                    <div
                      className="absolute inset-y-1 right-0 w-1 cursor-ew-resize rounded-full bg-primary/80"
                      onPointerDown={(event) => handlePointer(track as Track, clip.id, "trim-end", event)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TimeRuler = ({ duration, scale, onSeek }: { duration: number; scale: number; onSeek: (time: number) => void }) => {
  const ticks = Math.max(1, Math.ceil(duration));
  return (
    <div className="flex h-8 select-none border-b border-border bg-muted/40 text-[10px] text-muted-foreground">
      {Array.from({ length: ticks }, (_, index) => (
        <button
          key={index}
          type="button"
          className="relative flex-1 border-r border-border"
          style={{ width: `${scale}px` }}
          onClick={() => onSeek(index)}
        >
          <span className="absolute left-1 top-1">{index}s</span>
        </button>
      ))}
    </div>
  );
};

const snapTime = (value: number, snap: boolean) => {
  if (!snap) return value;
  return Math.round(value * 30) / 30;
};
