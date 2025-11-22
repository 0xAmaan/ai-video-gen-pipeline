/**
 * Timeline Component - Main orchestrator
 *
 * Modern, clean timeline rebuilt from scratch with CapCut-style UI
 * Follows separation of concerns: Timeline = UI Editor, VideoPlayer = Renderer
 *
 * Phase 1: Static rendering with zoom controls
 */

'use client'

import { Play, Pause } from 'lucide-react'
import { useTimelineZoom } from './hooks/useTimelineZoom'
import { usePixelConversion } from './hooks/usePixelConversion'
import { TimelineCanvas } from './TimelineCanvas'
import { formatTime } from './utils/time-formatting'
import type { TimelineProps } from './types'

export const Timeline = ({
  sequence,
  mediaAssets,
  currentTime,
  isPlaying,
  selectedClipIds,
  duration,
  onPlayPause,
  onSeek,
  onClipMove,
  onClipTrim,
  onClipSelect,
  onClipDelete,
  magneticSnapEnabled = true,
  showBeatMarkers = false,
  beatMarkers = [],
}: TimelineProps) => {
  // Calculate total duration
  const totalDuration = calculateTotalDuration(sequence)

  // Zoom management (with smart initial zoom based on content duration)
  const { zoomLevel, pixelsPerSecond, zoomIn, zoomOut, handleWheel } = useTimelineZoom(totalDuration)

  // Pixel conversion utilities
  const { getTimelineWidth } = usePixelConversion(pixelsPerSecond)

  // Calculate timeline width
  const timelineWidth = getTimelineWidth(totalDuration)

  // Handle background click to seek
  const handleBackgroundClick = (time: number) => {
    onSeek(Math.max(0, time))
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      {/* Unified Control Bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-[#181818] border-b border-[#4a4a4a]">
        {/* Left: Playback controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onPlayPause}
            className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#2a2a2a] rounded transition-colors"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <span className="text-sm font-mono text-gray-400 min-w-[140px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-[#4a4a4a]" />

        {/* Center: Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="px-3 py-1 text-sm text-gray-300 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
            title="Zoom Out (Ctrl + Scroll Down)"
          >
            −
          </button>
          <span className="px-2 text-xs text-gray-400 min-w-[60px] text-center">
            {(zoomLevel * 100).toFixed(0)}%
          </span>
          <button
            onClick={zoomIn}
            className="px-3 py-1 text-sm text-gray-300 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
            title="Zoom In (Ctrl + Scroll Up)"
          >
            +
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Info display */}
        <div className="text-xs text-gray-500">
          {sequence.tracks?.length || 0} tracks · {getTotalClipCount(sequence)} clips
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <TimelineCanvas
          sequence={sequence}
          mediaAssets={mediaAssets}
          currentTime={currentTime}
          isPlaying={isPlaying}
          selectedClipIds={selectedClipIds}
          onSeek={onSeek}
          onClipMove={onClipMove}
          onClipTrim={onClipTrim}
          onClipSelect={onClipSelect}
          onClipDelete={onClipDelete}
          magneticSnapEnabled={magneticSnapEnabled}
          showBeatMarkers={showBeatMarkers}
          beatMarkers={beatMarkers}
          zoomLevel={zoomLevel}
          pixelsPerSecond={pixelsPerSecond}
          timelineWidth={timelineWidth}
          onWheel={handleWheel}
          onBackgroundClick={handleBackgroundClick}
        />
      </div>
    </div>
  )
}

/**
 * Calculate total duration from sequence
 */
const calculateTotalDuration = (sequence: { tracks?: Array<{ clips: Array<{ start: number; duration: number }> }> }): number => {
  if (!sequence.tracks || sequence.tracks.length === 0) {
    return 60
  }

  let maxEnd = 0

  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.start + clip.duration
      if (clipEnd > maxEnd) {
        maxEnd = clipEnd
      }
    }
  }

  return maxEnd || 60
}

/**
 * Get total number of clips across all tracks
 */
const getTotalClipCount = (sequence: { tracks?: Array<{ clips: Array<unknown> }> }): number => {
  if (!sequence.tracks) return 0
  return sequence.tracks.reduce((count, track) => count + track.clips.length, 0)
}
