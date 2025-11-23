/**
 * Clips Layer - Renders clips with CapCut-style design
 *
 * Phase 3: With hover and selection feedback
 */

import React, { useState, useEffect } from 'react'
import { Layer, Group, Rect, Text, Image } from 'react-konva'
import type { Sequence, Clip, MediaAssetMeta } from '@/lib/editor/types'
import { TIMELINE_THEME, TIMELINE_LAYOUT } from '../types'

interface ClipsLayerProps {
  sequence: Sequence
  mediaAssets: Record<string, MediaAssetMeta>
  pixelsPerSecond: number
  selectedClipIds: string[]
  viewportHeight: number
}

export const ClipsLayer = ({ sequence, mediaAssets, pixelsPerSecond, selectedClipIds, viewportHeight }: ClipsLayerProps) => {
  const tracks = sequence.tracks || []

  // Calculate total height of all tracks
  const totalTracksHeight = tracks.length * TIMELINE_LAYOUT.trackHeight

  // Calculate vertical offset to center tracks in remaining space below ruler
  const availableHeight = viewportHeight - TIMELINE_LAYOUT.rulerHeight
  const centeredOffset = (availableHeight - totalTracksHeight) / 2

  return (
    <Layer>
      {tracks.map((track, trackIndex) => {
        const trackY = TIMELINE_LAYOUT.rulerHeight + Math.max(0, centeredOffset) + trackIndex * TIMELINE_LAYOUT.trackHeight

        return (
          <Group key={track.id}>
            {track.clips.map((clip) => (
              <ClipRect
                key={clip.id}
                clip={clip}
                mediaAsset={mediaAssets[clip.mediaId]}
                trackY={trackY}
                pixelsPerSecond={pixelsPerSecond}
                isSelected={selectedClipIds.includes(clip.id)}
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
  pixelsPerSecond: number
  isSelected: boolean
}

const ClipRect = ({ clip, mediaAsset, trackY, pixelsPerSecond, isSelected }: ClipRectProps) => {
  const [isHovered, setIsHovered] = React.useState(false)
  const [thumbnailImages, setThumbnailImages] = useState<HTMLImageElement[]>([])

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

  // Calculate position and size
  const x = clip.start * pixelsPerSecond
  const width = clip.duration * pixelsPerSecond
  const y = trackY + TIMELINE_LAYOUT.clipPadding
  const height = TIMELINE_LAYOUT.trackHeight - TIMELINE_LAYOUT.clipPadding * 2

  // Get clip color based on type and state
  const baseColor = getClipColor(clip.kind)
  const fillColor = isHovered ? TIMELINE_THEME.clipHover : baseColor

  // Calculate thumbnail tiling with fixed tile size
  // Thumbnails stay constant size, more/fewer tiles render as clip width changes
  const FIXED_TILE_WIDTH = 128 // Fixed width in pixels (maintains 16:9 with track height)
  const tilesNeeded = Math.ceil(width / FIXED_TILE_WIDTH)

  return (
    <Group
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Clip background with rounded corners */}
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fillColor}
        cornerRadius={TIMELINE_LAYOUT.clipBorderRadius}
        shadowColor="rgba(0, 0, 0, 0.3)"
        shadowBlur={isHovered ? 6 : 4}
        shadowOffset={{ x: 0, y: isHovered ? 3 : 2 }}
        shadowOpacity={isHovered ? 0.4 : 0.3}
      />

      {/* Thumbnail tiling (CapCut-style) */}
      {thumbnailImages.length > 0 && clip.kind === 'video' && (
        <Group clipX={x} clipY={y} clipWidth={width} clipHeight={height}>
          {Array.from({ length: tilesNeeded }).map((_, i) => {
            const thumbnailIndex = i % thumbnailImages.length // Cycle through available thumbnails
            const img = thumbnailImages[thumbnailIndex]
            if (!img) return null

            return (
              <Image
                key={i}
                image={img}
                x={x + i * FIXED_TILE_WIDTH}
                y={y}
                width={FIXED_TILE_WIDTH}
                height={height}
                opacity={0.6}
              />
            )
          })}
        </Group>
      )}

      {/* Selection border (CapCut-style blue border) */}
      {isSelected && (
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          stroke={TIMELINE_THEME.clipSelected}
          strokeWidth={TIMELINE_LAYOUT.clipSelectedBorderWidth}
          cornerRadius={TIMELINE_LAYOUT.clipBorderRadius}
        />
      )}

      {/* Clip label (media name or clip name) */}
      {width > 50 && (
        <Text
          x={x + 8}
          y={y + 8}
          text={getClipLabel(clip)}
          fontSize={12}
          fill={TIMELINE_THEME.textPrimary}
          fontFamily="system-ui, -apple-system, sans-serif"
          width={width - 16}
          ellipsis={true}
        />
      )}

      {/* Duration label (bottom right) */}
      {width > 60 && (
        <Text
          x={x + width - 60}
          y={y + height - 20}
          text={`${clip.duration.toFixed(1)}s`}
          fontSize={10}
          fill={TIMELINE_THEME.textSecondary}
          fontFamily="system-ui, -apple-system, sans-serif"
        />
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
