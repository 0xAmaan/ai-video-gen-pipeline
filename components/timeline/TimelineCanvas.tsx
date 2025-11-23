/**
 * Timeline Canvas - Konva Stage wrapper
 *
 * Orchestrates all layers and handles viewport scrolling
 */

'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage } from 'react-konva'
import type { TimelineProps } from './types'
import { TIMELINE_LAYOUT } from './types'
import { TracksLayer } from './layers/TracksLayer'
import { ClipsLayer } from './layers/ClipsLayer'
import { RulerLayer } from './layers/RulerLayer'
import { OverlayLayer } from './layers/OverlayLayer'

interface TimelineCanvasProps extends TimelineProps {
  zoomLevel: number
  pixelsPerSecond: number
  timelineWidth: number
  onWheel: (e: WheelEvent, scrollX: number) => { newScrollX: number; zoomed: boolean }
  onBackgroundClick: (time: number) => void
}

export const TimelineCanvas = ({
  sequence,
  mediaAssets,
  currentTime,
  selectedClipIds,
  onSeek,
  zoomLevel,
  pixelsPerSecond,
  timelineWidth,
  timelineSectionRef,
  onWheel,
  onBackgroundClick,
}: TimelineCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)

  // Update dimensions by observing the parent timeline section (not our own container)
  useEffect(() => {
    const updateDimensions = () => {
      // Observe the parent section for height (it's what actually resizes via grid)
      // But use our own container for width (for scrolling)
      const sectionElement = timelineSectionRef?.current
      const containerElement = containerRef.current

      if (sectionElement && containerElement) {
        const sectionRect = sectionElement.getBoundingClientRect()
        const containerRect = containerElement.getBoundingClientRect()

        setDimensions({
          width: containerRect.width,
          height: sectionRect.height
        })
      } else if (containerElement) {
        // Fallback to container if no section ref provided
        const rect = containerElement.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()

    const resizeObserver = new ResizeObserver(updateDimensions)

    // Observe the parent section element (the one that actually changes size)
    const observeElement = timelineSectionRef?.current || containerRef.current
    if (observeElement) {
      resizeObserver.observe(observeElement)
    }

    return () => resizeObserver.disconnect()
  }, [timelineSectionRef])

  // Handle wheel events for zoom
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      const scrollX = container.scrollLeft
      const result = onWheel(e, scrollX)

      if (result.zoomed) {
        // Update scroll position after zoom
        container.scrollLeft = result.newScrollX
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [onWheel])

  // Handle canvas clicks and scrubbing
  const handleStageClick = useCallback(
    (e: any) => {
      // Only fire on simple clicks, not after dragging
      if (isDragging) return

      const stage = e.target.getStage()
      const pointerPosition = stage.getPointerPosition()

      if (!pointerPosition || !containerRef.current) return

      // Calculate time from click position (accounting for scroll)
      const scrollX = containerRef.current.scrollLeft
      const clickX = pointerPosition.x + scrollX
      const time = clickX / pixelsPerSecond

      // Fire click callback
      onBackgroundClick(time)
    },
    [pixelsPerSecond, onBackgroundClick, isDragging]
  )

  const handleStageMouseDown = useCallback(
    (e: any) => {
      const stage = e.target.getStage()
      const pointerPosition = stage.getPointerPosition()

      if (!pointerPosition || !containerRef.current) return

      setIsDragging(true)

      // Immediately seek to clicked position
      const scrollX = containerRef.current.scrollLeft
      const clickX = pointerPosition.x + scrollX
      const time = Math.max(0, clickX / pixelsPerSecond)
      onSeek(time)
    },
    [pixelsPerSecond, onSeek]
  )

  const handleStageMouseMove = useCallback(
    (e: any) => {
      const stage = e.target.getStage()
      const pointerPosition = stage.getPointerPosition()

      if (!pointerPosition || !containerRef.current) return

      const scrollX = containerRef.current.scrollLeft
      const mouseX = pointerPosition.x + scrollX
      const time = Math.max(0, mouseX / pixelsPerSecond)

      // Update hover time for scrubber preview
      setHoverTime(time)

      // If dragging, seek to this position
      if (isDragging) {
        onSeek(time)
      }
    },
    [pixelsPerSecond, isDragging, onSeek]
  )

  const handleStageMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleStageMouseLeave = useCallback(() => {
    setHoverTime(null)
    setIsDragging(false)
  }, [])

  // Calculate total duration from sequence
  const totalDuration = calculateTotalDuration(sequence)

  // Ensure timeline width is at least the viewport width
  const effectiveTimelineWidth = Math.max(dimensions.width, timelineWidth)

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-auto bg-zinc-950"
      style={{
        scrollbarGutter: 'stable',
      }}
    >
      {/* Wrapper div to enable horizontal scrolling */}
      <div style={{ width: effectiveTimelineWidth, minHeight: '100%' }}>
        <Stage
          width={effectiveTimelineWidth}
          height={dimensions.height}
          onClick={handleStageClick}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onMouseLeave={handleStageMouseLeave}
        >
          {/* Layer order (bottom to top) */}
          <TracksLayer
            sequence={sequence}
            timelineWidth={effectiveTimelineWidth}
            viewportHeight={dimensions.height}
          />

          <ClipsLayer
            sequence={sequence}
            mediaAssets={mediaAssets}
            pixelsPerSecond={pixelsPerSecond}
            selectedClipIds={selectedClipIds}
            viewportHeight={dimensions.height}
          />

          <RulerLayer
            zoomLevel={zoomLevel}
            pixelsPerSecond={pixelsPerSecond}
            timelineWidth={effectiveTimelineWidth}
            totalDuration={totalDuration}
            stageHeight={dimensions.height}
          />

          <OverlayLayer
            currentTime={currentTime}
            pixelsPerSecond={pixelsPerSecond}
            viewportHeight={dimensions.height}
            hoverTime={hoverTime}
            showScrubber={!isDragging}
          />
        </Stage>
      </div>
    </div>
  )
}

/**
 * Calculate total duration from sequence
 * Finds the end time of the last clip
 */
const calculateTotalDuration = (sequence: { tracks?: Array<{ clips: Array<{ start: number; duration: number }> }> }): number => {
  if (!sequence.tracks || sequence.tracks.length === 0) {
    return 60 // Default 60 seconds if no tracks
  }

  let maxEnd = 0

  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.start + clip.duration
      if (clipEnd > maxEnd) {
        maxEnd = clipEnd
      }
    }
  }

  return maxEnd || 60 // Default to 60 if no clips
}
