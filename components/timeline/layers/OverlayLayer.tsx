/**
 * Overlay Layer - Playhead, scrubber, and snap guides
 *
 * Phase 3: Playhead + scrubber preview
 */

import { Layer, Line, Circle } from 'react-konva'
import { TIMELINE_THEME, TIMELINE_LAYOUT } from '../types'

interface OverlayLayerProps {
  currentTime: number
  pixelsPerSecond: number
  viewportHeight: number
  hoverTime?: number | null
  showScrubber?: boolean
}

export const OverlayLayer = ({
  currentTime,
  pixelsPerSecond,
  viewportHeight,
  hoverTime = null,
  showScrubber = false,
}: OverlayLayerProps) => {
  const playheadX = currentTime * pixelsPerSecond
  const scrubberX = hoverTime !== null ? hoverTime * pixelsPerSecond : null

  return (
    <Layer listening={false}>
      {/* Scrubber preview line (semi-transparent) */}
      {showScrubber && scrubberX !== null && (
        <Line
          points={[scrubberX, 0, scrubberX, viewportHeight]}
          stroke={TIMELINE_THEME.scrubber}
          strokeWidth={1}
        />
      )}

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
