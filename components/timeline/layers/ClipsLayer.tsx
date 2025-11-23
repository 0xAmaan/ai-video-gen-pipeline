/**
 * Clips Layer - Renders clips with CapCut-style design
 *
 * Phase 4: With drag and drop support
 */

import React, { useState, useEffect } from 'react'
import { Layer, Group, Rect, Text, Image, Shape, Circle, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Sequence, Clip, MediaAssetMeta } from '@/lib/editor/types'
import { TIMELINE_THEME, TIMELINE_LAYOUT } from '../types'
import {
  calculateClipSwap,
  getDropSlotIndex,
  findSnapPoints,
  checkSnap,
  calculateSnapThreshold
} from '@/lib/editor/clip-positioning'

export interface DropZoneInfo {
  slotIndex: number
  x: number
  y: number
  width: number
  height: number
  draggedClipId: string // ID of the clip being dragged
}

interface ClipsLayerProps {
  sequence: Sequence
  mediaAssets: Record<string, MediaAssetMeta>
  pixelsPerSecond: number
  selectedClipIds: string[]
  viewportHeight: number
  currentTime: number
  dropZone: DropZoneInfo | null
  onClipSelect: (clipIds: string[]) => void
  onClipMove: (updates: { clipId: string; newStart: number; newTrackId?: string }[]) => void
  onSnapGuideShow?: (snapPoint: number | null) => void
  onDropZoneChange?: (dropZone: DropZoneInfo | null) => void
}

export const ClipsLayer = ({
  sequence,
  mediaAssets,
  pixelsPerSecond,
  selectedClipIds,
  viewportHeight,
  currentTime,
  dropZone,
  onClipSelect,
  onClipMove,
  onSnapGuideShow,
  onDropZoneChange
}: ClipsLayerProps) => {
  const tracks = sequence.tracks || []

  // Calculate track positions using each track's height
  const trackPositions: Array<{ track: typeof tracks[0]; y: number; height: number }> = []
  let currentY = TIMELINE_LAYOUT.rulerHeight + TIMELINE_LAYOUT.tracksTopMargin

  tracks.forEach((track) => {
    trackPositions.push({
      track,
      y: currentY,
      height: track.height,
    })
    currentY += track.height
  })

  return (
    <Layer>
      {trackPositions.map(({ track, y, height }) => {
        return (
          <Group key={track.id}>
            {track.clips.map((clip, clipIndex) => (
              <ClipRect
                key={clip.id}
                clip={clip}
                mediaAsset={mediaAssets[clip.mediaId]}
                trackY={y}
                trackHeight={height}
                trackId={track.id}
                allClips={track.clips}
                allTrackPositions={trackPositions}
                pixelsPerSecond={pixelsPerSecond}
                isSelected={selectedClipIds.includes(clip.id)}
                clipIndex={clipIndex}
                currentTime={currentTime}
                dropZone={dropZone}
                onClipSelect={onClipSelect}
                onClipMove={onClipMove}
                onSnapGuideShow={onSnapGuideShow}
                onDropZoneChange={onDropZoneChange}
              />
            ))}
          </Group>
        )
      })}
    </Layer>
  )
}

/**
 * Individual clip rectangle with CapCut-style design and thumbnail tiling
 */
interface ClipRectProps {
  clip: Clip
  mediaAsset?: MediaAssetMeta
  trackY: number
  trackHeight: number
  trackId: string
  allClips: Clip[]
  allTrackPositions: Array<{ track: any; y: number; height: number }>
  pixelsPerSecond: number
  isSelected: boolean
  clipIndex: number
  currentTime: number
  dropZone: DropZoneInfo | null
  onClipSelect: (clipIds: string[]) => void
  onClipMove: (updates: { clipId: string; newStart: number; newTrackId?: string }[]) => void
  onSnapGuideShow?: (snapPoint: number | null) => void
  onDropZoneChange?: (dropZone: DropZoneInfo | null) => void
}

const ClipRect = ({
  clip,
  mediaAsset,
  trackY,
  trackHeight,
  trackId,
  allClips,
  allTrackPositions,
  pixelsPerSecond,
  isSelected,
  clipIndex,
  currentTime,
  dropZone,
  onClipSelect,
  onClipMove,
  onSnapGuideShow,
  onDropZoneChange
}: ClipRectProps) => {
  const [isHovered, setIsHovered] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [thumbnailImages, setThumbnailImages] = useState<HTMLImageElement[]>([])
  const [dragStartX, setDragStartX] = useState(0)
  const [originalStart, setOriginalStart] = useState(0)
  const [dragTargetTrackId, setDragTargetTrackId] = useState<string | null>(null)

  // Helper function to calculate which track the mouse is over
  const calculateTargetTrack = (mouseY: number): string | null => {
    for (const trackPos of allTrackPositions) {
      if (mouseY >= trackPos.y && mouseY < trackPos.y + trackPos.height) {
        return trackPos.track.id
      }
    }
    return null
  }

  // Load thumbnails from data URLs (like KonvaClipItem)
  useEffect(() => {
    if (!mediaAsset?.thumbnails?.length) {
      setThumbnailImages([])
      return
    }

    const images: HTMLImageElement[] = []
    let loadedCount = 0

    mediaAsset.thumbnails.forEach((dataUrl, index) => {
      const img = new window.Image()
      img.onload = () => {
        images[index] = img
        loadedCount++
        if (loadedCount === mediaAsset.thumbnails!.length) {
          setThumbnailImages([...images])
        }
      }
      img.onerror = () => {
        console.warn('Failed to load thumbnail', index, 'for clip:', clip.id)
      }
      img.src = dataUrl // Use data URL from thumbnails array
      images[index] = img
    })

    return () => {
      images.forEach((img) => {
        img.onload = null
        img.onerror = null
      })
    }
  }, [mediaAsset?.thumbnails, clip.id])

  // Drag handlers
  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    setIsDragging(true)
    setDragStartX(e.target.x())
    setOriginalStart(clip.start)
    // Clear drop zone initially
    onDropZoneChange?.(null)
  }

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    const node = e.target
    const newX = node.x()
    const newY = node.y()

    // Get absolute Y position from stage
    const stage = node.getStage()
    const pointerPos = stage?.getPointerPosition()

    // Calculate which track the cursor is over
    const targetTrack = pointerPos ? calculateTargetTrack(pointerPos.y) : null
    setDragTargetTrackId(targetTrack)

    // Convert pixel position to time
    const gapOffset = clipIndex * TIMELINE_LAYOUT.clipGap
    const newStart = Math.max(0, (newX - gapOffset) / pixelsPerSecond)

    // Find snap points and check for snapping
    const snapPoints = findSnapPoints(clip, allClips, currentTime)
    const snapThreshold = calculateSnapThreshold(pixelsPerSecond)
    const snapResult = checkSnap(newStart, snapPoints, snapThreshold)

    // If snapped, update position
    if (snapResult.snapped) {
      const snappedX = snapResult.position * pixelsPerSecond + gapOffset
      node.x(snappedX)
      onSnapGuideShow?.(snapResult.snapPoint)
    } else {
      onSnapGuideShow?.(null)
    }

    // Calculate drop zone info for the TARGET track
    const targetTrackPosition = allTrackPositions.find(tp => tp.track.id === (targetTrack || trackId))
    const targetTrackClips = targetTrackPosition?.track.clips || allClips
    const dropSlotIndex = getDropSlotIndex(newStart, clip.id, targetTrackClips)

    // Get the sorted clips (excluding dragged clip)
    const sortedClips = targetTrackClips
      .filter((c: Clip) => c.id !== clip.id)
      .sort((a: Clip, b: Clip) => a.start - b.start)

    // Calculate where the drop zone should be displayed
    let dropZoneX = 0
    if (dropSlotIndex === 0) {
      // Dropping at the beginning
      dropZoneX = 0
    } else if (dropSlotIndex >= sortedClips.length) {
      // Dropping at the end
      const lastClip = sortedClips[sortedClips.length - 1]
      dropZoneX = (lastClip.start + lastClip.duration) * pixelsPerSecond
    } else {
      // Dropping between clips
      const prevClip = sortedClips[dropSlotIndex - 1]
      dropZoneX = (prevClip.start + prevClip.duration) * pixelsPerSecond
    }

    const targetTrackY = targetTrackPosition?.y || trackY
    const targetHeight = targetTrackPosition?.height || trackHeight

    onDropZoneChange?.({
      slotIndex: dropSlotIndex,
      x: dropZoneX,
      y: targetTrackY + TIMELINE_LAYOUT.clipPadding,
      width,
      height: targetHeight - TIMELINE_LAYOUT.clipPadding * 2,
      draggedClipId: clip.id
    })

    // Allow vertical movement to follow cursor (no constraint)
    // The clip will visually move to show which track it's over
  }

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    setIsDragging(false)
    onSnapGuideShow?.(null)
    onDropZoneChange?.(null) // Clear drop zone

    // Reset cursor
    const stage = e.target.getStage()
    if (stage) {
      stage.container().style.cursor = 'default'
    }

    const node = e.target
    const finalX = node.x()

    // Convert final pixel position to time
    const gapOffset = clipIndex * TIMELINE_LAYOUT.clipGap
    const newStart = Math.max(0, (finalX - gapOffset) / pixelsPerSecond)

    // Check for final snap
    const snapPoints = findSnapPoints(clip, allClips, currentTime)
    const snapThreshold = calculateSnapThreshold(pixelsPerSecond)
    const snapResult = checkSnap(newStart, snapPoints, snapThreshold)
    const finalStart = snapResult.snapped ? snapResult.position : newStart

    // Determine if track changed
    const finalTrackId = dragTargetTrackId || trackId
    const trackChanged = finalTrackId !== trackId

    // Calculate swap logic for all affected clips
    // If track changed, use target track's clips, otherwise use current track's clips
    const targetTrackPosition = allTrackPositions.find(tp => tp.track.id === finalTrackId)
    const targetClips = trackChanged ? (targetTrackPosition?.track.clips || []) : allClips
    const swapUpdates = calculateClipSwap(clip.id, finalStart, finalTrackId, targetClips)

    // Add track change info to the update
    const updates = swapUpdates.map((update, index) => ({
      ...update,
      ...(trackChanged && index === 0 ? { newTrackId: finalTrackId } : {}),
    }))

    // Reset position to original (parent will update via props)
    node.x(x)
    node.y(y)

    // Clear drag target
    setDragTargetTrackId(null)

    // Fire callback to update state
    if (updates.length > 0) {
      onClipMove(updates)
    }
  }

  // Calculate position and size
  const width = clip.duration * pixelsPerSecond
  const y = trackY + TIMELINE_LAYOUT.clipPadding
  const height = trackHeight - TIMELINE_LAYOUT.clipPadding * 2

  // Check if this clip is being dragged
  const isBeingDragged = dropZone && dropZone.draggedClipId === clip.id

  // Calculate base position (cumulative layout, not time-based during drag)
  let x: number = clip.start * pixelsPerSecond + clipIndex * TIMELINE_LAYOUT.clipGap

  if (dropZone) {
    // During drag: Layout clips WITHOUT the dragged clip, with drop zone as placeholder
    const draggedClip = allClips.find((c) => c.id === dropZone.draggedClipId)
    if (!draggedClip) {
      x = clip.start * pixelsPerSecond + clipIndex * TIMELINE_LAYOUT.clipGap
    } else {
      // Get clips without the dragged one, sorted by start time
      const sortedWithoutDragged = allClips
        .filter((c) => c.id !== dropZone.draggedClipId)
        .sort((a, b) => a.start - b.start)

      const currentClipIndex = sortedWithoutDragged.findIndex((c) => c.id === clip.id)

      if (!isBeingDragged && currentClipIndex !== -1) {
        // Calculate cumulative position: sum of all widths before this clip
        let cumulativeX = 0

        for (let i = 0; i < sortedWithoutDragged.length; i++) {
          if (i === dropZone.slotIndex) {
            // Add drop zone width at its slot position
            cumulativeX += dropZone.width + TIMELINE_LAYOUT.clipGap
          }

          if (i === currentClipIndex) {
            // This is our clip's position
            x = cumulativeX
            break
          }

          // Add this clip's width
          cumulativeX += sortedWithoutDragged[i].duration * pixelsPerSecond + TIMELINE_LAYOUT.clipGap
        }

        // Handle case where drop zone is after all clips
        if (currentClipIndex >= 0 && x === undefined) {
          x = cumulativeX
        }
      } else {
        x = clip.start * pixelsPerSecond + clipIndex * TIMELINE_LAYOUT.clipGap
      }
    }
  } else {
    // No drag: normal time-based positioning
    x = clip.start * pixelsPerSecond + clipIndex * TIMELINE_LAYOUT.clipGap
  }

  // Get clip color based on type and state
  const baseColor = getClipColor(clip.kind)
  const fillColor = isHovered ? TIMELINE_THEME.clipHover : baseColor

  // Calculate thumbnail tiling with fixed tile size
  // Thumbnails stay constant size, more/fewer tiles render as clip width changes
  const FIXED_TILE_WIDTH = 128 // Fixed width in pixels (maintains 16:9 with track height)
  const tilesNeeded = Math.ceil(width / FIXED_TILE_WIDTH)

  // Handle cursor changes
  const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
    setIsHovered(true)
    const stage = e.target.getStage()
    if (stage) {
      stage.container().style.cursor = 'pointer'
    }
  }

  const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
    setIsHovered(false)
    const stage = e.target.getStage()
    if (stage && !isDragging) {
      stage.container().style.cursor = 'default'
    }
  }

  // Hide the dragged clip's static position, only show the dragged version
  if (isBeingDragged && !isDragging) {
    return null
  }

  return (
    <Group
      x={x}
      y={y}
      draggable={true}
      opacity={isBeingDragged ? 0.6 : 1.0}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        if (isDragging) return // Prevent selection during drag
        e.cancelBubble = true // Prevent event from bubbling to stage (prevents seek)
        onClipSelect([clip.id])
      }}
    >
      {/* Clip background with rounded corners */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={fillColor}
        cornerRadius={TIMELINE_LAYOUT.clipBorderRadius}
        shadowColor="rgba(0, 0, 0, 0.3)"
        shadowBlur={isDragging ? 8 : isHovered ? 6 : 4}
        shadowOffset={{ x: 0, y: isDragging ? 4 : isHovered ? 3 : 2 }}
        shadowOpacity={isDragging ? 0.5 : isHovered ? 0.4 : 0.3}
      />

      {/* Thumbnail tiling (CapCut-style) */}
      {thumbnailImages.length > 0 && clip.kind === 'video' && (
        <Group
          clipFunc={(ctx) => {
            ctx.beginPath()
            ctx.roundRect(0, 0, width, height, TIMELINE_LAYOUT.clipBorderRadius)
            ctx.closePath()
          }}
        >
          {Array.from({ length: tilesNeeded }).map((_, i) => {
            const thumbnailIndex = i % thumbnailImages.length // Cycle through available thumbnails
            const img = thumbnailImages[thumbnailIndex]
            if (!img) return null

            return (
              <Image
                key={i}
                image={img}
                x={i * FIXED_TILE_WIDTH}
                y={0}
                width={FIXED_TILE_WIDTH}
                height={height}
                opacity={isDragging ? 0.8 : 1.0}
              />
            )
          })}
        </Group>
      )}

      {/* Waveform visualization for audio clips */}
      {clip.kind === 'audio' && mediaAsset?.waveform && (
        <WaveformRenderer
          waveform={mediaAsset.waveform}
          clipDuration={clip.duration}
          clipTrimStart={clip.trimStart}
          width={width}
          height={height}
          color={TIMELINE_THEME.waveform}
          opacity={isDragging ? 0.6 : 0.8}
        />
      )}

      {/* Selection border (CapCut-style blue border) */}
      {isSelected && (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          stroke={TIMELINE_THEME.clipSelected}
          strokeWidth={TIMELINE_LAYOUT.clipSelectedBorderWidth}
          cornerRadius={TIMELINE_LAYOUT.clipBorderRadius}
        />
      )}

      {/* Clip label (media name or clip name) */}
      {width > 50 && (
        <>
          <Rect
            x={4}
            y={4}
            width={Math.min(width - 8, 200)}
            height={20}
            fill="rgba(0, 0, 0, 0.6)"
            cornerRadius={4}
          />
          <Text
            x={8}
            y={8}
            text={getClipLabel(clip)}
            fontSize={12}
            fill={TIMELINE_THEME.textPrimary}
            fontFamily="system-ui, -apple-system, sans-serif"
            width={width - 16}
            ellipsis={true}
          />
        </>
      )}

      {/* Duration label (bottom right) */}
      {width > 60 && (
        <>
          <Rect
            x={width - 64}
            y={height - 22}
            width={60}
            height={18}
            fill="rgba(0, 0, 0, 0.6)"
            cornerRadius={4}
          />
          <Text
            x={width - 60}
            y={height - 20}
            text={`${clip.duration.toFixed(1)}s`}
            fontSize={10}
            fill={TIMELINE_THEME.textSecondary}
            fontFamily="system-ui, -apple-system, sans-serif"
          />
        </>
      )}

      {/* Link indicator (top right) - shows if clip is linked to another clip */}
      {clip.linkedClipId && width > 40 && (
        <Group x={width - 24} y={6}>
          {/* Chain link icon */}
          <Circle
            x={0}
            y={0}
            radius={8}
            fill="rgba(59, 130, 246, 0.9)"
            stroke="#ffffff"
            strokeWidth={1}
          />
          {/* Link symbol (two small circles connected) */}
          <Circle x={-2} y={-1} radius={2} fill="#ffffff" />
          <Circle x={2} y={1} radius={2} fill="#ffffff" />
          <Line
            points={[-1, -1, 1, 1]}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        </Group>
      )}
    </Group>
  )
}

/**
 * Get clip color based on kind
 * CapCut-style color scheme
 */
const getClipColor = (kind: string): string => {
  switch (kind) {
    case 'video':
      return TIMELINE_THEME.clip // Default gray
    case 'audio':
      return '#2a4a2a' // Dark green tint for audio
    case 'image':
      return '#3a3a4a' // Purple tint for images
    default:
      return TIMELINE_THEME.clip
  }
}

/**
 * Get clip label from clip data
 */
const getClipLabel = (clip: Clip): string => {
  // Prefer clip name, fallback to media ID
  return clip.mediaId || 'Unnamed Clip'
}

/**
 * Waveform Renderer Component
 * Renders audio waveform visualization using Konva Shape
 */
interface WaveformRendererProps {
  waveform: Float32Array
  clipDuration: number
  clipTrimStart: number
  width: number
  height: number
  color: string
  opacity?: number
}

const WaveformRenderer = ({
  waveform,
  clipDuration,
  clipTrimStart,
  width,
  height,
  color,
  opacity = 0.8
}: WaveformRendererProps) => {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        // Calculate which portion of the waveform to display based on trim
        const totalDuration = waveform.length / 100 // Assuming 100 samples per second
        const trimEndTime = clipTrimStart + clipDuration

        // Calculate sample range
        const startSample = Math.floor((clipTrimStart / totalDuration) * waveform.length)
        const endSample = Math.ceil((trimEndTime / totalDuration) * waveform.length)
        const visibleSamples = waveform.slice(startSample, Math.min(endSample, waveform.length))

        if (visibleSamples.length === 0) return

        // Calculate how many pixels per sample
        const pixelsPerSample = width / visibleSamples.length

        // Draw waveform as vertical bars
        context.beginPath()
        context.fillStyle = color
        context.globalAlpha = opacity

        const centerY = height / 2
        const maxBarHeight = height * 0.8 // Leave some padding

        for (let i = 0; i < visibleSamples.length; i++) {
          const amplitude = visibleSamples[i]
          const barHeight = amplitude * maxBarHeight / 2
          const x = i * pixelsPerSample
          const y = centerY - barHeight

          // Draw vertical bar (both positive and negative for symmetric waveform)
          context.fillRect(x, y, Math.max(1, pixelsPerSample * 0.8), barHeight * 2)
        }

        context.fillStrokeShape(shape)
      }}
    />
  )
}
