"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import type { BeatMarker } from "@/types/audio";

interface BeatGridOverlayProps {
  beatMarkers: BeatMarker[];
  duration: number;
  containerWidth: number;
  zoom?: number;
  scrollLeft?: number;
  className?: string;
}

/**
 * Beat Grid Overlay for Twick Timeline
 *
 * Renders vertical beat marker lines on top of the Twick VideoEditor timeline.
 * Syncs with timeline scroll and zoom to maintain alignment with the time ruler.
 */
export const BeatGridOverlay = ({
  beatMarkers,
  duration,
  containerWidth,
  zoom = 1.5, // Twick's default zoom
  scrollLeft = 0,
  className = "",
}: BeatGridOverlayProps) => {
  const [timelineHeight, setTimelineHeight] = useState(400); // Default height
  const containerRef = useRef<HTMLDivElement>(null);

  // Observe timeline height changes
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setTimelineHeight(entry.contentRect.height);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Calculate pixels per second using Twick's exact formula
  // Twick formula: timelineWidth = duration * zoom * 100
  // Therefore: pixelsPerSecond = zoom * 100
  const pixelsPerSecond = useMemo(() => {
    return zoom * 100;
  }, [zoom]);

  // Convert time to pixel position
  const timeToPixels = (time: number): number => {
    return time * pixelsPerSecond - scrollLeft;
  };

  // Filter visible beat markers (viewport culling)
  const visibleBeatMarkers = useMemo(() => {
    const viewportStart = scrollLeft / pixelsPerSecond;
    const viewportEnd = (scrollLeft + containerWidth) / pixelsPerSecond;

    return beatMarkers.filter(
      (marker) => marker.time >= viewportStart - 1 && marker.time <= viewportEnd + 1
    );
  }, [beatMarkers, scrollLeft, pixelsPerSecond, containerWidth]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 5 }}
    >
      <svg
        width="100%"
        height="100%"
        className="absolute top-0 left-0"
        style={{ overflow: "visible" }}
      >
        {visibleBeatMarkers.map((beat, index) => {
          const x = timeToPixels(beat.time);

          // Skip markers outside visible area
          if (x < -10 || x > containerWidth + 10) return null;

          const isStrong =
            typeof beat.strength === "number"
              ? beat.strength >= 0.75
              : index % 4 === 0;

          return (
            <line
              key={`beat-${beat.time}-${index}`}
              x1={x}
              y1={0}
              x2={x}
              y2={timelineHeight}
              stroke={isStrong ? "#10B981" : "rgba(16,185,129,0.4)"}
              strokeWidth={isStrong ? 1.5 : 1}
              strokeDasharray={isStrong ? undefined : "4 6"}
              opacity={1}
            />
          );
        })}
      </svg>
    </div>
  );
};
