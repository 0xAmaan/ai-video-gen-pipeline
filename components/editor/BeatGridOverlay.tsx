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
  bpm?: number; // BPM for fallback grid when beatMarkers is empty
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
  bpm,
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

  // Generate BPM grid as fallback when no beat markers available
  const bpmGridMarkers = useMemo(() => {
    if (beatMarkers.length > 0 || !bpm || bpm <= 0) return [];

    const beatInterval = 60 / bpm; // seconds per beat
    const markers: BeatMarker[] = [];

    for (let time = 0; time <= duration; time += beatInterval) {
      markers.push({
        time,
        strength: 0.5,
        isDownbeat: Math.round(time / beatInterval) % 4 === 0,
      });
    }

    return markers;
  }, [beatMarkers.length, bpm, duration]);

  // Use detected beat markers or fallback to BPM grid
  const effectiveMarkers = beatMarkers.length > 0 ? beatMarkers : bpmGridMarkers;

  // Filter visible beat markers (viewport culling)
  const visibleBeatMarkers = useMemo(() => {
    const viewportStart = scrollLeft / pixelsPerSecond;
    const viewportEnd = (scrollLeft + containerWidth) / pixelsPerSecond;

    return effectiveMarkers.filter(
      (marker) => marker.time >= viewportStart - 1 && marker.time <= viewportEnd + 1
    );
  }, [effectiveMarkers, scrollLeft, pixelsPerSecond, containerWidth]);

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

          // Determine beat type: downbeat > strong beat > weak beat
          const isDownbeat = beat.isDownbeat === true;
          const isStrong =
            !isDownbeat &&
            (typeof beat.strength === "number"
              ? beat.strength >= 0.75
              : index % 4 === 0);

          // Visual styling based on beat type
          let stroke: string;
          let strokeWidth: number;
          let strokeDasharray: string | undefined;

          if (isDownbeat) {
            // Downbeats: solid, thicker, brighter green
            stroke = "#10B981";
            strokeWidth = 2;
            strokeDasharray = undefined;
          } else if (isStrong) {
            // Strong beats: solid, medium thickness, medium green
            stroke = "rgba(16,185,129,0.7)";
            strokeWidth = 1.5;
            strokeDasharray = undefined;
          } else {
            // Weak beats: dashed, thin, faint green
            stroke = "rgba(16,185,129,0.3)";
            strokeWidth = 1;
            strokeDasharray = "4 6";
          }

          return (
            <line
              key={`beat-${beat.time}-${index}`}
              x1={x}
              y1={0}
              x2={x}
              y2={timelineHeight}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              opacity={1}
            />
          );
        })}
      </svg>
    </div>
  );
};
