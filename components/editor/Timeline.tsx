"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Sequence, TimelineSelection, Track, MediaAssetMeta, Clip } from "@/lib/editor/types";

const BASE_SCALE = 120; // px per second at zoom 1
const MIN_TIMELINE_WIDTH = 2000; // px

type DragMode = "move" | "trim-start" | "trim-end";

interface TimelineProps {
  sequence: Sequence;
  selection: TimelineSelection;
  zoom: number;
  snap: boolean;
  currentTime: number;
  assets: MediaAssetMeta[]; // Media assets for thumbnail lookup
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
  assets,
  onSelectionChange,
  onMoveClip,
  onTrimClip,
  onSeek,
  onZoomChange,
}: TimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ start: 0, end: 10 });
  const scale = useMemo(() => BASE_SCALE * zoom, [zoom]);
  const timelineWidth = useMemo(
    () => Math.max(sequence.duration * scale, MIN_TIMELINE_WIDTH),
    [scale, sequence.duration],
  );
  const visibleSeconds = timelineWidth / scale;

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

  const scrubToClientX = (clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const offset = clientX - rect.left + container.scrollLeft;
    const bounded = Math.max(0, Math.min(offset, timelineWidth));
    const duration = sequence.duration || 0;
    const nextTime = duration === 0 ? 0 : Math.min(bounded / scale, duration);
    onSeek(nextTime);
  };

  const startScrub = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    scrubToClientX(event.clientX);
    const move = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      scrubToClientX(pointerEvent.clientX);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

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
      <div className="relative flex-1 overflow-hidden bg-background">
        <div ref={containerRef} className="relative h-full overflow-x-auto overflow-y-hidden">
          <div
            className="relative min-h-full"
            style={{ width: `${timelineWidth}px` }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                startScrub(event as ReactPointerEvent<HTMLElement>);
              }
            }}
          >
            <div className="bg-muted/30">
              <TimeRuler
                scale={scale}
                visibleSeconds={visibleSeconds}
                onPointerDown={startScrub}
              />
            </div>
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary"
              style={{ left: `${Math.min(currentTime, sequence.duration) * scale}px` }}
            />
            <button
              type="button"
              aria-label="Scrub timeline"
              className="absolute z-20 top-1 h-4 w-3 -translate-x-1/2 rounded-sm border border-primary bg-primary text-transparent shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/70"
              style={{ left: `${Math.min(currentTime, sequence.duration) * scale}px` }}
              onPointerDown={startScrub}
            />
            {clips.map((track) => (
              <div key={track.id} className="border-b border-border py-3">
                <p className="px-2 text-xs font-semibold uppercase text-muted-foreground">{track.id}</p>
                <div
                  className="relative h-16"
                  onPointerDown={(event) => {
                    if (event.target === event.currentTarget) {
                      startScrub(event as ReactPointerEvent<HTMLElement>);
                    }
                  }}
                >
                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`absolute h-14 cursor-move rounded-md border px-2 py-1 text-xs overflow-hidden ${
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
                      {/* Render video thumbnails as background */}
                      {clip.kind === "video" && (() => {
                        const asset = assets.find((a) => a.id === clip.mediaId);
                        if (!asset) {
                          console.warn(`[Timeline] Asset not found for clip ${clip.id}, mediaId: ${clip.mediaId}`);
                          return null;
                        }
                        if (!asset.thumbnails || asset.thumbnails.length === 0) {
                          console.log(`[Timeline] No thumbnails yet for asset ${asset.id} (clip ${clip.id})`);
                          return null;
                        }
                        if (asset.thumbnails.length > 0) {
                          const clipWidth = clip.duration * scale;
                          const THUMBNAIL_MIN_WIDTH = 40; // Minimum width per thumbnail
                          const availableThumbnails = asset.thumbnails.length;
                          const maxThumbnailsToShow = Math.floor(clipWidth / THUMBNAIL_MIN_WIDTH);
                          const thumbnailsToShow = Math.min(maxThumbnailsToShow, availableThumbnails);
                          
                          if (thumbnailsToShow > 0) {
                            const thumbnailWidth = clipWidth / thumbnailsToShow;
                            
                            // Select which thumbnails to display based on trim
                            const trimRatio = clip.trimStart / asset.duration;
                            const visibleDurationRatio = clip.duration / asset.duration;
                            const startIndex = Math.floor(trimRatio * availableThumbnails);
                            const endIndex = Math.min(
                              availableThumbnails,
                              Math.ceil((trimRatio + visibleDurationRatio) * availableThumbnails)
                            );
                            
                            const thumbnailsToRender = asset.thumbnails.slice(startIndex, endIndex);
                            const step = Math.max(1, Math.floor(thumbnailsToRender.length / thumbnailsToShow));
                            
                            return (
                              <div className="absolute inset-0 flex pointer-events-none">
                                {Array.from({ length: thumbnailsToShow }).map((_, i) => {
                                  const thumbnailIndex = Math.min(
                                    thumbnailsToRender.length - 1,
                                    i * step
                                  );
                                  const thumbnail = thumbnailsToRender[thumbnailIndex];
                                  
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        width: `${thumbnailWidth}px`,
                                        height: '100%',
                                      }}
                                      className="relative flex-shrink-0"
                                    >
                                      <img
                                        src={thumbnail}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                                        draggable={false}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}
                      <div className="flex justify-between text-[11px] relative z-10">
                        <span>{clip.id}</span>
                        <span>{clip.duration.toFixed(2)}s</span>
                      </div>
                      <div
                        className="absolute inset-y-1 left-0 w-1 cursor-ew-resize rounded-full bg-primary/80"
                        onPointerDown={(event) =>
                          handlePointer(track as Track, clip.id, "trim-start", event)
                        }
                      />
                      <div
                        className="absolute inset-y-1 right-0 w-1 cursor-ew-resize rounded-full bg-primary/80"
                        onPointerDown={(event) =>
                          handlePointer(track as Track, clip.id, "trim-end", event)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TimeRuler = ({
  visibleSeconds,
  scale,
  onPointerDown,
}: {
  visibleSeconds: number;
  scale: number;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}) => {
  const ticks = Math.max(1, Math.ceil(visibleSeconds));
  return (
    <div
      className="relative h-8 select-none border-b border-border bg-muted/40 text-[10px] text-muted-foreground"
      style={{ width: `${visibleSeconds * scale}px` }}
      onPointerDown={onPointerDown}
      role="presentation"
    >
      {Array.from({ length: ticks + 1 }, (_, index) => (
        <div
          key={index}
          className="absolute top-0 flex h-full flex-col justify-end border-l border-border"
          style={{ left: `${index * scale}px` }}
        >
          <span className="mb-1 ml-1">{index}s</span>
        </div>
      ))}
    </div>
  );
};

const snapTime = (value: number, snap: boolean) => {
  if (!snap) return value;
  return Math.round(value * 30) / 30;
};
