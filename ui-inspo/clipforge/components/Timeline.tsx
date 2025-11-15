import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Text } from 'react-konva';
import { MultiClipTimelineProps } from '../types';
import { formatTime } from '../utils/timeFormat';
import { ClipItem } from './ClipItem';

/**
 * Timeline component - Canvas-based timeline using Konva
 * Shows multiple video clips, playhead, trim handles, and time markers
 * Supports drag-to-reorder, per-clip trimming, and horizontal scrolling for long timelines
 */
export const Timeline = ({
  clips,
  selectedClipId,
  currentTime,
  totalDuration,
  onClipSelect,
  onClipMove,
  onClipReorder,
  onClipTrim,
  onSeek,
  onScrub,
  onScrubEnd,
}: MultiClipTimelineProps) => {
  // Container width tracking
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom level (1.0 = default, 0.5 = zoomed out, 4.0 = zoomed in)
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4.0;

  // Scrubber state (for hover preview)
  const [isHovering, setIsHovering] = useState(false);
  const [scrubberTime, setScrubberTime] = useState(0);
  const scrubAnimationFrameRef = useRef<number | null>(null);
  const lastScrubTimeRef = useRef<number>(0);

  // Drag state for clip reordering
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [draggedClipX, setDraggedClipX] = useState<number>(0);
  const [virtualClipOrder, setVirtualClipOrder] = useState<typeof clips>([]);

  // Constants
  const CLIP_HEIGHT = 120; // Doubled from 60px
  const PLAYHEAD_COLOR = '#9CA3AF'; // Gray for actual playhead
  const SCRUBBER_COLOR = '#EF4444'; // Red for hover scrubber
  const MARKER_COLOR = 'white';
  const DEFAULT_TIMELINE_DURATION = 300; // 5 minutes in seconds

  // Fixed timeline track height
  const TIMELINE_HEIGHT = 140; // Height for the canvas
  const CLIP_Y = 10; // Small padding from top of canvas

  // Calculate effective timeline duration (minimum 5 minutes)
  const effectiveDuration = Math.max(DEFAULT_TIMELINE_DURATION, totalDuration);

  // Padding for timestamp text (to prevent cutoff at edges) - ONLY for text labels, not functional positioning
  const TEXT_PADDING = 60; // 30px on each side for timestamp text visibility

  // Calculate pixels per second: fit 5 minutes in view, then become scrollable for longer durations
  // Multiply by zoomLevel to allow zooming in/out
  const PIXELS_PER_SECOND = (containerWidth / DEFAULT_TIMELINE_DURATION) * zoomLevel;

  // Calculate timeline width - add extra padding so end markers don't get cut off
  // The extra width allows the 5:00 marker text to be fully visible
  const TIMELINE_WIDTH = effectiveDuration * PIXELS_PER_SECOND + 50; // Padding for marker text (25px on each side)

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Handle mouse wheel zoom (Ctrl/Cmd + scroll)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only zoom if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();

      if (!containerRef.current) return;

      // Get mouse position relative to container
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const scrollLeft = containerRef.current.scrollLeft;

      // Calculate the time value under the cursor BEFORE zoom
      const timeUnderCursor = pixelsToTime(mouseX + scrollLeft);

      // Calculate new zoom level
      const zoomSensitivity = 0.003; // Adjust for smooth zooming (50% faster than 0.002)
      const zoomDelta = -e.deltaY * zoomSensitivity;
      const newZoomLevel = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoomLevel + zoomDelta)
      );

      // Only update if zoom level actually changed
      if (newZoomLevel !== zoomLevel) {
        setZoomLevel(newZoomLevel);

        // After zoom, calculate where that time value is now in pixels
        // We need to do this in the next frame after state updates
        requestAnimationFrame(() => {
          if (!containerRef.current) return;

          // Calculate new pixel position of the time that was under cursor
          const newPixelsPerSecond = (containerWidth / DEFAULT_TIMELINE_DURATION) * newZoomLevel;
          const newPixelPosition = timeUnderCursor * newPixelsPerSecond;

          // Calculate new scroll position to keep that time under cursor
          const newScrollLeft = newPixelPosition - mouseX;

          // Apply new scroll position
          containerRef.current.scrollLeft = Math.max(0, newScrollLeft);
        });
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [zoomLevel, containerWidth]);

  // Helper functions for pixel conversion
  const timeToPixels = (time: number): number => {
    return time * PIXELS_PER_SECOND;
  };

  const pixelsToTime = (pixels: number): number => {
    return pixels / PIXELS_PER_SECOND;
  };

  // Get appropriate marker interval based on zoom level
  const getMarkerInterval = (zoom: number): number => {
    if (zoom >= 3) return 5;      // 5 seconds at very high zoom (3x-4x)
    if (zoom >= 1.5) return 15;   // 15 seconds at high zoom (1.5x-3x)
    if (zoom >= 0.75) return 30;  // 30 seconds at normal zoom (0.75x-1.5x)
    return 60;                     // 60 seconds at low zoom (0.5x-0.75x)
  };

  /**
   * Handle mouse move over timeline (for scrubber preview)
   * Throttled with requestAnimationFrame for performance
   */
  const handleTimelineMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (pointerPosition) {
      const hoveredTime = pixelsToTime(pointerPosition.x);
      const clampedTime = Math.max(0, Math.min(effectiveDuration, hoveredTime));

      // Update scrubber position immediately for visual feedback
      setScrubberTime(clampedTime);
      setIsHovering(true);

      // Throttle video preview updates with requestAnimationFrame
      if (onScrub && scrubAnimationFrameRef.current === null) {
        scrubAnimationFrameRef.current = requestAnimationFrame(() => {
          // Only update if time has changed significantly (>0.1s)
          if (Math.abs(clampedTime - lastScrubTimeRef.current) > 0.1) {
            onScrub(clampedTime);
            lastScrubTimeRef.current = clampedTime;
          }
          scrubAnimationFrameRef.current = null;
        });
      }
    }
  };

  /**
   * Handle mouse leave timeline (hide scrubber)
   */
  const handleTimelineMouseLeave = () => {
    setIsHovering(false);
    // Cancel any pending animation frame
    if (scrubAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrubAnimationFrameRef.current);
      scrubAnimationFrameRef.current = null;
    }
    // Notify parent that scrubbing has ended
    if (onScrubEnd) {
      onScrubEnd();
    }
  };

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (scrubAnimationFrameRef.current !== null) {
        cancelAnimationFrame(scrubAnimationFrameRef.current);
      }
    };
  }, []);

  // Initialize virtual clip order when clips change (and not dragging)
  useEffect(() => {
    if (!draggingClipId) {
      setVirtualClipOrder([...clips]);
    }
  }, [clips, draggingClipId]);

  /**
   * Handle clip drag start
   */
  const handleClipDragStart = (clipId: string, startX: number) => {
    setDraggingClipId(clipId);
    setDraggedClipX(startX);
  };

  /**
   * Handle clip drag move - update virtual order based on position
   */
  const handleClipDragMove = (clipId: string, currentX: number) => {
    setDraggedClipX(currentX);

    // Find the dragged clip and calculate its center position
    const draggedClip = virtualClipOrder.find(c => c.id === clipId);
    if (!draggedClip) return;

    const draggedClipCenter = currentX + (draggedClip.duration * PIXELS_PER_SECOND) / 2;

    // Create a new order by determining where the dragged clip should go
    const otherClips = virtualClipOrder.filter(c => c.id !== clipId);
    const newOrder = [...otherClips];

    // Find insertion index based on center point crossing
    let insertIndex = 0;
    let cumulativeTime = 0;

    for (let i = 0; i < otherClips.length; i++) {
      const clip = otherClips[i];
      const clipStart = cumulativeTime * PIXELS_PER_SECOND;
      const clipEnd = clipStart + (clip.duration * PIXELS_PER_SECOND);
      const clipCenter = (clipStart + clipEnd) / 2;

      if (draggedClipCenter > clipCenter) {
        insertIndex = i + 1;
      }

      cumulativeTime += clip.duration;
    }

    newOrder.splice(insertIndex, 0, draggedClip);
    setVirtualClipOrder(newOrder);
  };

  /**
   * Handle clip drag end - update actual clip positions
   */
  const handleClipDragEnd = (clipId: string) => {
    if (!draggingClipId) return;

    // Use reorder callback if available (preferred method)
    if (onClipReorder) {
      // Reflow the virtual order to ensure proper sequential positioning
      let cumulativeTime = 0;
      const reorderedClips = virtualClipOrder.map(clip => {
        const reflowedClip = {
          ...clip,
          timelineStart: cumulativeTime,
        };
        cumulativeTime += clip.duration;
        return reflowedClip;
      });

      onClipReorder(reorderedClips);
    } else {
      // Fallback to old method (onClipMove)
      let cumulativeTime = 0;
      const draggedClip = virtualClipOrder.find(c => c.id === clipId);

      for (const clip of virtualClipOrder) {
        if (clip.id === clipId) {
          break;
        }
        cumulativeTime += clip.duration;
      }

      // Update the clip's timeline position
      if (draggedClip) {
        onClipMove(clipId, cumulativeTime);
      }
    }

    // Clear drag state
    setDraggingClipId(null);
    setDraggedClipX(0);
  };

  /**
   * Handle clicking on the timeline to seek
   */
  const handleTimelineClick = (e: any) => {
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (pointerPosition) {
      const clickedTime = pixelsToTime(pointerPosition.x);
      // Clamp to effective timeline duration
      const clampedTime = Math.max(0, Math.min(effectiveDuration, clickedTime));
      onSeek(clampedTime);
    }
  };


  // Ref for syncing scroll between timestamp row and canvas
  const timestampScrollRef = useRef<HTMLDivElement>(null);

  // Sync scroll position between timestamp row and canvas
  const handleCanvasScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (timestampScrollRef.current) {
      timestampScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Time markers row */}
      <div
        ref={timestampScrollRef}
        className="relative h-6 overflow-x-auto overflow-y-hidden flex-shrink-0 bg-[#2a2a2a] flex items-center"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div
          className="relative pointer-events-none"
          style={{
            width: TIMELINE_WIDTH,
            height: '100%',
          }}
        >
          {(() => {
            const markers = [];
            const interval = getMarkerInterval(zoomLevel); // Adaptive intervals based on zoom

            // Add markers at regular intervals
            for (let time = 0; time < effectiveDuration; time += interval) {
              const x = timeToPixels(time);
              // Special case for 0:00 - left align with small padding to prevent cutoff
              const isStart = time === 0;
              markers.push(
                <div
                  key={`marker-${time}`}
                  className="absolute text-xs text-gray-400 font-mono"
                  style={{
                    left: isStart ? `${x + 10}px` : `${x}px`,
                    top: '50%',
                    transform: isStart ? 'translateY(-50%)' : 'translate(-50%, -50%)',
                  }}
                >
                  {formatTime(time)}
                </div>
              );
            }

            // Always add the final marker at the end - right aligned with padding to prevent cutoff
            const finalX = timeToPixels(effectiveDuration);
            markers.push(
              <div
                key={`marker-${effectiveDuration}`}
                className="absolute text-xs text-gray-400 font-mono"
                style={{
                  left: `${finalX - 10}px`,
                  top: '50%',
                  transform: 'translate(-100%, -50%)', // Right align instead of center
                }}
              >
                {formatTime(effectiveDuration)}
              </div>
            );

            return markers;
          })()}
        </div>
      </div>

      {/* Timeline canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
        onScroll={handleCanvasScroll}
        style={{ cursor: 'default', display: 'flex', alignItems: 'center' }}
      >
        {/* Invisible overlay for capturing mouse events in empty space */}
        {/* Uses pointer-events: auto but positioned behind Konva canvas (z-10) */}
        <div
          className="absolute"
          style={{
            cursor: 'default',
            width: `${TIMELINE_WIDTH}px`,
            height: '100%',
            top: 0,
            left: 0,
            zIndex: 10, // Behind Konva Stage (which is z-index auto/0 in stacking context)
            pointerEvents: 'auto',
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left + containerRef.current!.scrollLeft;
            const hoveredTime = pixelsToTime(x);
            const clampedTime = Math.max(0, Math.min(effectiveDuration, hoveredTime));
            setScrubberTime(clampedTime);
            setIsHovering(true);

            // Throttle video preview updates with requestAnimationFrame
            if (onScrub && scrubAnimationFrameRef.current === null) {
              scrubAnimationFrameRef.current = requestAnimationFrame(() => {
                if (Math.abs(clampedTime - lastScrubTimeRef.current) > 0.1) {
                  onScrub(clampedTime);
                  lastScrubTimeRef.current = clampedTime;
                }
                scrubAnimationFrameRef.current = null;
              });
            }
          }}
          onMouseLeave={handleTimelineMouseLeave}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left + containerRef.current!.scrollLeft;
            const clickedTime = pixelsToTime(x);
            const clampedTime = Math.max(0, Math.min(effectiveDuration, clickedTime));
            onSeek(clampedTime);
          }}
        />

        {/* Scrubber line (red - shows on hover) - z-index: 30 (above Konva) */}
        {isHovering && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${timeToPixels(scrubberTime)}px`,
              top: '-24px', // Extend up into timestamp area (24px = 6px timestamp height)
              width: '2px',
              height: 'calc(100% + 24px)',
              backgroundColor: SCRUBBER_COLOR,
              zIndex: 30,
            }}
          />
        )}

        {/* Playhead line (white - shows actual playback position) - z-index: 40 (above scrubber) */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${timeToPixels(currentTime)}px`,
            top: '-24px', // Extend up into timestamp area
            width: '2px',
            height: 'calc(100% + 24px)',
            backgroundColor: 'white',
            zIndex: 40,
          }}
        />

      <Stage
        width={TIMELINE_WIDTH}
        height={TIMELINE_HEIGHT}
        onMouseMove={handleTimelineMouseMove}
        onMouseLeave={handleTimelineMouseLeave}
        style={{ position: 'relative', zIndex: 20, cursor: 'default' }}
      >
        <Layer>
          {/* Background - capture clicks for seeking */}
          <Rect
            x={0}
            y={0}
            width={TIMELINE_WIDTH}
            height={TIMELINE_HEIGHT}
            fill="#1a1a1a"
            onClick={handleTimelineClick}
          />

          {/* Empty timeline track - visible when no clips */}
          <Rect
            x={0}
            y={CLIP_Y}
            width={TIMELINE_WIDTH}
            height={CLIP_HEIGHT}
            fill="#000000"
            cornerRadius={4}
          />

          {/* Render ghost placeholder for dragged clip */}
          {draggingClipId && (() => {
            const draggedClip = clips.find(c => c.id === draggingClipId);
            if (!draggedClip) return null;

            // Find position in virtual order
            let ghostX = 0;
            for (const clip of virtualClipOrder) {
              if (clip.id === draggingClipId) break;
              ghostX += clip.duration * PIXELS_PER_SECOND;
            }

            const ghostWidth = draggedClip.duration * PIXELS_PER_SECOND;

            return (
              <>
                {/* Blue outlined box with transparent fill */}
                <Rect
                  x={ghostX}
                  y={CLIP_Y}
                  width={ghostWidth}
                  height={CLIP_HEIGHT}
                  fill="rgba(59, 130, 246, 0.2)"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  cornerRadius={4}
                  listening={false}
                />
              </>
            );
          })()}

          {/* Render all clips */}
          {virtualClipOrder.map((clip, index) => {
            // Calculate position based on virtual order
            let clipTimelineStart = 0;
            for (let i = 0; i < index; i++) {
              clipTimelineStart += virtualClipOrder[i].duration;
            }

            const isDragging = clip.id === draggingClipId;

            return (
              <ClipItem
                key={clip.id}
                clip={{...clip, timelineStart: clipTimelineStart}}
                isSelected={clip.id === selectedClipId}
                pixelsPerSecond={PIXELS_PER_SECOND}
                xOffset={0}
                isDragging={isDragging}
                dragX={isDragging ? draggedClipX : undefined}
                onSelect={() => onClipSelect(clip.id)}
                onDragStart={(startX) => handleClipDragStart(clip.id, startX)}
                onDragMove={(currentX) => handleClipDragMove(clip.id, currentX)}
                onDragEnd={() => handleClipDragEnd(clip.id)}
                onTrim={(newSourceStart, newSourceEnd) =>
                  onClipTrim(clip.id, newSourceStart, newSourceEnd)
                }
              />
            );
          })}

        </Layer>
      </Stage>
      </div>
    </div>
  );
};
