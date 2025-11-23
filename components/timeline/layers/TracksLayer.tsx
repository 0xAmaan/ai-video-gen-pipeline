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

  // Calculate vertical centering for tracks within the visible viewport
  const CONTROL_BAR_HEIGHT = 48 // Control bar height (fixed)
  const tracksTotalHeight = tracks.length * TIMELINE_LAYOUT.trackHeight
  const availableHeight = viewportHeight - TIMELINE_LAYOUT.rulerHeight - CONTROL_BAR_HEIGHT
  const centeredOffset = (availableHeight - tracksTotalHeight) / 2

  return (
    <Layer>
      {tracks.map((track, index) => {
        // Position track with centering, but ensure minimum top margin
        const trackY =
          TIMELINE_LAYOUT.rulerHeight +
          Math.max(TIMELINE_LAYOUT.tracksTopMargin, centeredOffset) +
          index * TIMELINE_LAYOUT.trackHeight

        const isAlternate = index % 2 === 1

        return (
          <Group key={track.id}>
            {/* Track background */}
            <Rect
              x={0}
              y={trackY}
              width={timelineWidth}
              height={TIMELINE_LAYOUT.trackHeight}
              fill={isAlternate ? TIMELINE_THEME.trackAltRow : TIMELINE_THEME.background}
            />

            {/* Track label area */}
            <Rect
              x={0}
              y={trackY}
              width={TIMELINE_LAYOUT.trackLabelWidth}
              height={TIMELINE_LAYOUT.trackHeight}
              fill={isAlternate ? TIMELINE_THEME.trackAltRow : TIMELINE_THEME.background}
              opacity={1}
            />

            {/* Track label text */}
            <Text
              x={TIMELINE_LAYOUT.trackPadding * 2}
              y={trackY + TIMELINE_LAYOUT.trackHeight / 2 - 8}
              text={getTrackLabel(track.kind, index)}
              fontSize={14}
              fill={TIMELINE_THEME.textSecondary}
              fontFamily="system-ui, -apple-system, sans-serif"
            />

            {/* Track separator line (subtle) */}
            {index < tracks.length - 1 && (
              <Rect
                x={0}
                y={trackY + TIMELINE_LAYOUT.trackHeight}
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

/**
 * Get track label based on kind and index
 */
const getTrackLabel = (kind: string, index: number): string => {
  switch (kind) {
    case 'video':
      return `Video ${index + 1}`
    case 'audio':
      return `Audio ${index + 1}`
    case 'overlay':
      return `Overlay ${index + 1}`
    case 'fx':
      return `FX ${index + 1}`
    default:
      return `Track ${index + 1}`
  }
}
