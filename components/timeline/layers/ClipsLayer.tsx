/**
 * Clips Layer - Renders clips with CapCut-style design
 *
 * Phase 4: With drag and drop support
 */

import React, { useState, useEffect } from 'react'
import { Layer, Group, Rect, Text, Image } from 'react-konva'
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
  onClipMove: (updates: { clipId: string; newStart: number }[]) => void
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

  // Calculate vertical centering for tracks within the visible viewport
  const CONTROL_BAR_HEIGHT = 48 // Control bar height (fixed)
  const tracksTotalHeight = tracks.length * TIMELINE_LAYOUT.trackHeight
  const availableHeight = viewportHeight - TIMELINE_LAYOUT.rulerHeight - CONTROL_BAR_HEIGHT
  const centeredOffset = (availableHeight - tracksTotalHeight) / 2

  return (
    <Layer>
      {tracks.map((track, trackIndex) => {
        // Position track with centering, but ensure minimum top margin
        const trackY =
          TIMELINE_LAYOUT.rulerHeight +
          Math.max(TIMELINE_LAYOUT.tracksTopMargin, centeredOffset) +
          trackIndex * TIMELINE_LAYOUT.trackHeight

        return (
          <Group key={track.id}>
            {track.clips.map((clip, clipIndex) => (
              <ClipRect
                key={clip.id}
                clip={clip}
                mediaAsset={mediaAssets[clip.mediaId]}
                trackY={trackY}
                trackId={track.id}
                allClips={track.clips}
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
  trackId: string
  allClips: Clip[]
  pixelsPerSecond: number
  isSelected: boolean
  clipIndex: number
  currentTime: number
  dropZone: DropZoneInfo | null
  onClipSelect: (clipIds: string[]) => void
  onClipMove: (updates: { clipId: string; newStart: number }[]) => void
  onSnapGuideShow?: (snapPoint: number | null) => void
  onDropZoneChange?: (dropZone: DropZoneInfo | null) => void
}

const ClipRect = ({
  clip,
  mediaAsset,
  trackY,
  trackId,
  allClips,
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

    // Calculate drop zone info
    const dropSlotIndex = getDropSlotIndex(newStart, clip.id, allClips)

    // Calculate drop zone position
    // Get the sorted clips (excluding dragged clip)
    const otherClips = allClips
      .filter((c) => c.id !== clip.id)
      .sort((a, b) => a.start - b.start)

    // Calculate where the drop zone should be displayed
    let dropZoneX = 0
    if (dropSlotIndex === 0) {
      // Dropping at the beginning
      dropZoneX = 0
    } else if (dropSlotIndex >= otherClips.length) {
      // Dropping at the end
      const lastClip = otherClips[otherClips.length - 1]
      dropZoneX = (lastClip.start + lastClip.duration) * pixelsPerSecond
    } else {
      // Dropping between clips
      const prevClip = otherClips[dropSlotIndex - 1]
      dropZoneX = (prevClip.start + prevClip.duration) * pixelsPerSecond
    }

    onDropZoneChange?.({
      slotIndex: dropSlotIndex,
      x: dropZoneX,
      y: trackY + TIMELINE_LAYOUT.clipPadding,
      width,
      height,
      draggedClipId: clip.id
    })

    // Constrain Y position (no vertical movement)
    node.y(y)
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

    // Calculate swap logic for all affected clips
    const updates = calculateClipSwap(clip.id, finalStart, trackId, allClips)

    // Reset position to original (parent will update via props)
    node.x(x)
    node.y(y)

    // Fire callback to update state
    if (updates.length > 0) {
      onClipMove(updates)
    }
  }

  // Calculate position and size
  // Add gap offset: each clip after the first gets offset by clipIndex * clipGap
  const gapOffset = clipIndex * TIMELINE_LAYOUT.clipGap
  let baseX = clip.start * pixelsPerSecond + gapOffset
  const width = clip.duration * pixelsPerSecond
  const y = trackY + TIMELINE_LAYOUT.clipPadding
  const height = TIMELINE_LAYOUT.trackHeight - TIMELINE_LAYOUT.clipPadding * 2

  // Calculate drag offset - shift clips to make room for drop zone
  let dragOffset = 0
  if (dropZone && dropZone.draggedClipId !== clip.id) {
    // Get sorted clips (excluding dragged clip)
    const sortedClips = allClips
      .filter((c) => c.id !== dropZone.draggedClipId)
      .sort((a, b) => a.start - b.start)

    // Find current clip's index in sorted array
    const currentClipIndex = sortedClips.findIndex((c) => c.id === clip.id)

    // If this clip is at or after the drop slot, shift it right
    if (currentClipIndex >= dropZone.slotIndex) {
      dragOffset = dropZone.width
    }
  }

  const x = baseX + dragOffset

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

  return (
    <Group
      x={x}
      y={y}
      draggable={true}
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
