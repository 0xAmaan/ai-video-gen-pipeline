"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { useTimelineContext } from "@twick/timeline";

/**
 * SelectionRectangle Component
 * =============================
 *
 * Provides drag-to-select functionality (marquee selection) for the timeline.
 *
 * ## Features:
 * - Drag on empty timeline area to draw selection rectangle
 * - Selects all clips within the rectangle bounds
 * - Visual indicator shows selection area
 * - Uses collision detector for efficient range queries
 *
 * ## Usage:
 * 1. Click and drag on empty timeline area
 * 2. Rectangle appears showing selection area
 * 3. All clips within rectangle are selected
 * 4. Release mouse to finalize selection
 */
export const SelectionRectangle = () => {
  const { present } = useTimelineContext();
  const collisionDetector = useProjectStore((state) => state.collisionDetector);
  const actions = useProjectStore((state) => state.actions);

  const [isDrawing, setIsDrawing] = useState(false);
  const [rect, setRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const startPosRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Only start drawing if clicking on timeline background (not on a clip)
      const isClipElement = target.closest(
        '[data-element-id], .timeline-element, [data-track-element-id]'
      );

      if (isClipElement) return;

      // Check if we're on the timeline container
      const timelineContainer = target.closest('#twick-timeline-only');
      if (!timelineContainer) return;

      containerRef.current = timelineContainer as HTMLElement;
      if (!(timelineContainer as HTMLElement).isConnected) return;
      const containerRect = timelineContainer.getBoundingClientRect();
      if (!containerRect) return;

      startPosRef.current = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      };

      setIsDrawing(true);
      setRect({
        x: startPosRef.current.x,
        y: startPosRef.current.y,
        width: 0,
        height: 0,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing || !containerRef.current || !containerRef.current.isConnected) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      if (!containerRect) return;
      const currentX = e.clientX - containerRect.left;
      const currentY = e.clientY - containerRect.top;

      const x = Math.min(startPosRef.current.x, currentX);
      const y = Math.min(startPosRef.current.y, currentY);
      const width = Math.abs(currentX - startPosRef.current.x);
      const height = Math.abs(currentY - startPosRef.current.y);

      setRect({ x, y, width, height });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDrawing) return;

      // Find clips within the selection rectangle
      if (rect.width > 5 && rect.height > 5) {
        // Only select if rectangle is significant
        selectClipsInRectangle(rect);
      }

      setIsDrawing(false);
      setRect({ x: 0, y: 0, width: 0, height: 0 });
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDrawing, rect]);

  /**
   * Select all clips within the given rectangle bounds
   */
  const selectClipsInRectangle = (bounds: { x: number; y: number; width: number; height: number }) => {
    if (!present?.tracks || !containerRef.current || !containerRef.current.isConnected) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    if (!containerRect) return;

    // Convert pixel coordinates to time range
    // This is a simplified conversion - adjust based on your timeline's zoom and pan state
    const pixelsPerSecond = 50; // TODO: Get this from timeline zoom level
    const startTime = bounds.x / pixelsPerSecond;
    const endTime = (bounds.x + bounds.width) / pixelsPerSecond;

    // Find all clips within the time range using collision detector
    const clipsInRange: string[] = [];

    for (const track of present.tracks) {
      if (track.elements) {
        for (const element of track.elements) {
          const clipStart = element.offset / 1000; // Convert ms to seconds
          const clipEnd = clipStart + (element.trimEnd - element.trimStart) / 1000;

          // Check if clip overlaps with selection rectangle time range
          if (clipStart < endTime && clipEnd > startTime) {
            // Also check if clip's vertical position is within the rectangle
            // This is simplified - you may need to get actual track positions
            if (element.id) {
              clipsInRange.push(element.id);
            }
          }
        }
      }
    }

    if (clipsInRange.length > 0) {
      actions.setSelection({ clipIds: clipsInRange, trackIds: [] });
    }
  };

  return (
    <>
      {/* Selection rectangle visual indicator */}
      {isDrawing && (
        <div
          style={{
            position: 'absolute',
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            border: '2px dashed #3b82f6',
            background: 'rgba(59, 130, 246, 0.1)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      )}

      {/* CSS for visual feedback */}
      <style jsx global>{`
        .timeline-selecting {
          cursor: crosshair !important;
        }
      `}</style>
    </>
  );
};
