/**
 * Overlay Layer - Playhead and snap guides
 *
 * Phase 3: Main playhead indicator
 */

import { Layer, Line, Circle } from 'react-konva'
import { TIMELINE_THEME, TIMELINE_LAYOUT } from '../types'

interface OverlayLayerProps {
  currentTime: number
  pixelsPerSecond: number
  viewportHeight: number
}

export const OverlayLayer = ({
  currentTime,
  pixelsPerSecond,
  viewportHeight,
}: OverlayLayerProps) => {
  const playheadX = currentTime * pixelsPerSecond

  return (
    <Layer listening={false}>
      {/* Playhead line (CapCut-style red) */}
      <Line
        points={[playheadX, 0, playheadX, viewportHeight]}
        stroke={TIMELINE_THEME.playhead}
        strokeWidth={2}
      />

      {/* Playhead indicator at top (circle) */}
      <Circle
        x={playheadX}
        y={TIMELINE_LAYOUT.rulerHeight / 2}
        radius={6}
        fill={TIMELINE_THEME.playhead}
        shadowColor="rgba(0, 0, 0, 0.5)"
        shadowBlur={4}
        shadowOffset={{ x: 0, y: 2 }}
      />
    </Layer>
  )
}
