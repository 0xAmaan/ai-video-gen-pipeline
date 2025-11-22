/**
 * Ruler Layer - Time markers at top of timeline
 *
 * Zoom-adaptive intervals (ported from Legacy timeline)
 */

import { Layer, Rect, Line, Text } from 'react-konva'
import { TIMELINE_THEME, TIMELINE_LAYOUT } from '../types'
import { formatTime } from '../utils/time-formatting'

interface RulerLayerProps {
  zoomLevel: number
  pixelsPerSecond: number
  timelineWidth: number
  totalDuration: number
  stageHeight: number
}

export const RulerLayer = ({
  zoomLevel,
  pixelsPerSecond,
  timelineWidth,
  totalDuration,
  stageHeight,
}: RulerLayerProps) => {
  const interval = getMarkerInterval(zoomLevel)
  const subInterval = getSubInterval(interval)

  const markers: Array<{ time: number; x: number; isMajor: boolean }> = []
  const subMarkers: Array<{ time: number; x: number }> = []

  // Generate major time markers (with labels)
  for (let time = 0; time <= totalDuration + interval; time += interval) {
    const x = time * pixelsPerSecond
    markers.push({ time, x, isMajor: true })
  }

  // Generate sub-interval tick marks (between major markers)
  for (let time = subInterval; time <= totalDuration; time += subInterval) {
    // Skip if this is a major interval (already has a label)
    if (time % interval === 0) continue

    const x = time * pixelsPerSecond
    subMarkers.push({ time, x })
  }

  return (
    <Layer>
      {/* Ruler background */}
      <Rect
        x={0}
        y={0}
        width={timelineWidth}
        height={TIMELINE_LAYOUT.rulerHeight}
        fill={TIMELINE_THEME.ruler}
      />

      {/* Sub-interval tick marks */}
      {subMarkers.map(({ time, x }) => (
        <Line
          key={`tick-${time}`}
          points={[x, TIMELINE_LAYOUT.rulerHeight - 8, x, TIMELINE_LAYOUT.rulerHeight]}
          stroke={TIMELINE_THEME.textMuted}
          strokeWidth={1}
          listening={false}
        />
      ))}

      {/* Major time markers with labels */}
      {markers.map(({ time, x, isMajor }) => (
        <Ruler key={time} time={time} x={x} isMajor={isMajor} />
      ))}

      {/* Bottom border */}
      <Rect
        x={0}
        y={TIMELINE_LAYOUT.rulerHeight - 1}
        width={timelineWidth}
        height={1}
        fill={TIMELINE_THEME.clipBorder}
        opacity={0.5}
      />
    </Layer>
  )
}

/**
 * Individual ruler marker
 */
const Ruler = ({ time, x, isMajor }: { time: number; x: number; isMajor: boolean }) => {
  const tickHeight = isMajor ? 20 : 10
  const tickY = TIMELINE_LAYOUT.rulerHeight - tickHeight

  return (
    <>
      {/* Tick line */}
      <Line
        points={[x, tickY, x, TIMELINE_LAYOUT.rulerHeight]}
        stroke={isMajor ? TIMELINE_THEME.textSecondary : TIMELINE_THEME.textMuted}
        strokeWidth={1}
      />

      {/* Time label (only for major ticks) */}
      {isMajor && (
        <Text
          x={x + 4}
          y={4}
          text={formatTime(time)}
          fontSize={11}
          fill={TIMELINE_THEME.textSecondary}
          fontFamily="system-ui, -apple-system, sans-serif"
        />
      )}
    </>
  )
}

/**
 * Determine marker interval based on zoom level
 * Ported from Legacy timeline with improvements
 *
 * @param zoomLevel Current zoom level (0.5x to 4.0x)
 * @returns Interval in seconds
 */
const getMarkerInterval = (zoomLevel: number): number => {
  // Very zoomed out (< 0.8x): 1 minute intervals
  if (zoomLevel < 0.8) return 60

  // Zoomed out (0.8x - 1.5x): 10 second intervals
  if (zoomLevel < 1.5) return 10

  // Normal (1.5x - 2.5x): 5 second intervals
  if (zoomLevel < 2.5) return 5

  // Zoomed in (2.5x - 3.5x): 1 second intervals
  if (zoomLevel < 3.5) return 1

  // Very zoomed in (> 3.5x): 0.5 second intervals
  return 0.5
}

/**
 * Calculate sub-interval for tick marks between major markers
 * Ported from Legacy timeline
 *
 * @param majorInterval Major interval in seconds
 * @returns Sub-interval in seconds (typically 1/5 of major interval)
 */
const getSubInterval = (majorInterval: number): number => {
  if (majorInterval === 60) return 10   // 6 divisions for 1 minute
  if (majorInterval === 10) return 2    // 5 divisions for 10 seconds
  if (majorInterval === 5) return 1     // 5 divisions for 5 seconds
  if (majorInterval === 1) return 0.2   // 5 divisions for 1 second
  if (majorInterval === 0.5) return 0.1 // 5 divisions for 0.5 seconds
  return majorInterval / 5 // Default: 5 divisions
}
