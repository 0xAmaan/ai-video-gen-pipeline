/**
 * Drop Zone Indicator - CapCut-style drop preview
 *
 * Shows a semi-transparent blue rectangle with dashed border
 * indicating where a clip will land when dropped
 */

import React from 'react'
import { Layer, Rect } from 'react-konva'
import type { DropZoneInfo } from './ClipsLayer'
import { TIMELINE_LAYOUT } from '../types'

interface DropZoneIndicatorProps {
  dropZone: DropZoneInfo | null
}

export const DropZoneIndicator = ({ dropZone }: DropZoneIndicatorProps) => {
  if (!dropZone) {
    return <Layer /> // Empty layer when no drop zone
  }

  return (
    <Layer>
      {/* Semi-transparent blue background */}
      <Rect
        x={dropZone.x}
        y={dropZone.y}
        width={dropZone.width}
        height={dropZone.height}
        fill="#3b82f6" // Blue
        opacity={0.2}
        cornerRadius={TIMELINE_LAYOUT.clipBorderRadius}
      />

      {/* Dashed border */}
      <Rect
        x={dropZone.x}
        y={dropZone.y}
        width={dropZone.width}
        height={dropZone.height}
        stroke="#3b82f6" // Blue
        strokeWidth={2}
        dash={[8, 4]}
        opacity={0.8}
        cornerRadius={TIMELINE_LAYOUT.clipBorderRadius}
      />
    </Layer>
  )
}
