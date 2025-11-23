/**
 * Snap Guides Layer - Visual feedback for magnetic snapping
 *
 * Shows vertical lines when clips snap to:
 * - Other clip edges (green)
 * - Playhead position (red)
 * - Timeline start (blue)
 */

import React from 'react'
import { Layer, Line } from 'react-konva'
import { TIMELINE_LAYOUT } from '../types'

interface SnapGuidesLayerProps {
  snapPosition: number | null // Time position to show snap guide (in seconds)
  pixelsPerSecond: number
  viewportHeight: number
}

export const SnapGuidesLayer = ({
  snapPosition,
  pixelsPerSecond,
  viewportHeight
}: SnapGuidesLayerProps) => {
  if (snapPosition === null) {
    return <Layer /> // Empty layer when no snap
  }

  // Convert time to pixel position
  const x = snapPosition * pixelsPerSecond

  // Determine color based on position
  const isTimelineStart = snapPosition === 0
  const color = isTimelineStart ? '#3b82f6' : '#22c55e' // Blue for start, green for clip edges

  return (
    <Layer>
      {/* Vertical snap guide line */}
      <Line
        points={[x, TIMELINE_LAYOUT.rulerHeight, x, viewportHeight]}
        stroke={color}
        strokeWidth={2}
        dash={[4, 4]}
        opacity={0.8}
      />
    </Layer>
  )
}
