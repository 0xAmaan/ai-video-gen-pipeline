/**
 * Tracks Layer - Renders track backgrounds and labels
 *
 * CapCut-style visual design with alternating track colors
 */

import { Layer, Rect, Text, Group } from 'react-konva'
import type { Sequence } from '@/lib/editor/types'
import { TIMELINE_THEME, TIMELINE_LAYOUT } from '../types'

interface TracksLayerProps {
  sequence: Sequence
  timelineWidth: number
  viewportHeight: number
}

export const TracksLayer = ({ sequence, timelineWidth, viewportHeight }: TracksLayerProps) => {
  const tracks = sequence.tracks || []

  // Calculate total height of all tracks and positions
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
      {trackPositions.map(({ track, y, height }, index) => {
        const isAlternate = index % 2 === 1

        return (
          <Group key={track.id}>
            {/* Track background */}
            <Rect
              x={0}
              y={y}
              width={timelineWidth}
              height={height}
              fill={isAlternate ? TIMELINE_THEME.trackAltRow : TIMELINE_THEME.background}
            />

            {/* Track separator line (subtle) */}
            {index < tracks.length - 1 && (
              <Rect
                x={0}
                y={y + height}
                width={timelineWidth}
                height={1}
                fill={TIMELINE_THEME.clipBorder}
                opacity={0.3}
              />
            )}
          </Group>
        )
      })}
    </Layer>
  )
}

