/**
 * Timeline Component - Main orchestrator
 *
 * Modern, clean timeline rebuilt from scratch with CapCut-style UI
 * Follows separation of concerns: Timeline = UI Editor, VideoPlayer = Renderer
 *
 * Phase 1: Static rendering with zoom controls
 */

'use client'

import { useState } from 'react'
import { Play, Pause, Plus } from 'lucide-react'
import { useTimelineZoom } from './hooks/useTimelineZoom'
import { usePixelConversion } from './hooks/usePixelConversion'
import { TimelineCanvas } from './TimelineCanvas'
import { TrackHeader } from './TrackHeader'
import { ClipContextMenu } from './ClipContextMenu'
import { formatTime } from './utils/time-formatting'
import type { TimelineProps } from './types'
import type { Clip } from '@/lib/editor/types'
import { TIMELINE_LAYOUT } from './types'

export const Timeline = ({
  sequence,
  mediaAssets,
  currentTime,
  isPlaying,
  selectedClipIds,
  duration,
  timelineSectionRef,
  onPlayPause,
  onSeek,
  onClipMove,
  onClipTrim,
  onClipSelect,
  onClipDelete,
  onClipDuplicate,
  onClipAdd,
  onTrackAdd,
  onTrackRemove,
  onTrackUpdate,
  onClipContextMenu,
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

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ clip: Clip; x: number; y: number } | null>(null)

  // Handler functions for track management
  const handleVolumeChange = (trackId: string, volume: number) => {
    onTrackUpdate?.(trackId, { volume })
  }

  const handleToggleMute = (trackId: string) => {
    const track = sequence.tracks.find(t => t.id === trackId)
    if (track) {
      onTrackUpdate?.(trackId, { muted: !track.muted })
    }
  }

  const handleToggleSolo = (trackId: string) => {
    const track = sequence.tracks.find(t => t.id === trackId)
    if (track) {
      onTrackUpdate?.(trackId, { solo: !track.solo })
    }
  }

  const handleToggleLock = (trackId: string) => {
    const track = sequence.tracks.find(t => t.id === trackId)
    if (track) {
      onTrackUpdate?.(trackId, { locked: !track.locked })
    }
  }

  const handleToggleVisible = (trackId: string) => {
    const track = sequence.tracks.find(t => t.id === trackId)
    if (track) {
      onTrackUpdate?.(trackId, { visible: !track.visible })
    }
  }

  // Context menu handlers
  const handleClipContextMenu = (clip: Clip, x: number, y: number) => {
    setContextMenu({ clip, x, y })
  }

  const handleSplitClipFromMenu = (clipId: string) => {
    console.log('Split clip:', clipId)
    // TODO: Implement split clip at playhead
  }

  const handleDetachAudio = (clipId: string) => {
    console.log('Detach audio:', clipId)
    // TODO: Implement detach audio
  }

  const handleUnlinkClip = (clipId: string) => {
    console.log('Unlink clip:', clipId)
    // TODO: Implement unlink clip
  }

  const handleDuplicateClip = (clipId: string) => {
    onClipDuplicate?.(clipId)
  }

  const handleDeleteClipFromMenu = (clipId: string) => {
    onClipDelete?.([clipId])
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      {/* Unified Control Bar */}
      <div className="flex items-center px-4 py-2.5 bg-[#181818] border-b border-[#4a4a4a]">
        {/* Left spacer */}
        <div className="flex-1" />

        {/* Center: Playback controls */}
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

        {/* Right spacer + Zoom controls */}
        <div className="flex-1 flex items-center justify-end gap-1">
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
      </div>

      {/* Timeline Content: Track Headers (left) + Canvas (right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Track Headers */}
        <div
          className="w-[200px] bg-[#181818] border-r border-[#3a3a3a] overflow-y-auto flex-shrink-0"
          style={{ width: `${TIMELINE_LAYOUT.trackLabelWidth + 80}px` }}
        >
          {/* Ruler spacer */}
          <div style={{ height: `${TIMELINE_LAYOUT.rulerHeight}px` }} className="bg-[#0a0a0a] border-b border-[#3a3a3a]" />

          {/* Top margin spacer */}
          <div
            style={{ height: `${TIMELINE_LAYOUT.tracksTopMargin}px` }}
            className="bg-[#181818] flex items-center justify-center gap-1 px-2"
          >
            {onTrackAdd && (
              <>
                <button
                  onClick={() => onTrackAdd('video')}
                  className="flex-1 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors flex items-center justify-center gap-1"
                  title="Add Video Track"
                >
                  <Plus className="w-3 h-3" />
                  Video
                </button>
                <button
                  onClick={() => onTrackAdd('audio')}
                  className="flex-1 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors flex items-center justify-center gap-1"
                  title="Add Audio Track"
                >
                  <Plus className="w-3 h-3" />
                  Audio
                </button>
              </>
            )}
          </div>

          {/* Track Headers */}
          {sequence.tracks.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              onVolumeChange={handleVolumeChange}
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onToggleLock={handleToggleLock}
              onToggleVisible={handleToggleVisible}
              onDelete={onTrackRemove}
            />
          ))}
        </div>

        {/* Right: Timeline Canvas */}
        <div className="flex-1 relative">
          <TimelineCanvas
            sequence={sequence}
            mediaAssets={mediaAssets}
            currentTime={currentTime}
            isPlaying={isPlaying}
            selectedClipIds={selectedClipIds}
            duration={duration}
            onPlayPause={onPlayPause}
            onSeek={onSeek}
            onClipMove={onClipMove}
            onClipTrim={onClipTrim}
            onClipSelect={onClipSelect}
            onClipDelete={onClipDelete}
            onClipAdd={onClipAdd}
            onClipContextMenu={onClipContextMenu || handleClipContextMenu}
            magneticSnapEnabled={magneticSnapEnabled}
            showBeatMarkers={showBeatMarkers}
            beatMarkers={beatMarkers}
            zoomLevel={zoomLevel}
            pixelsPerSecond={pixelsPerSecond}
            timelineWidth={timelineWidth}
            timelineSectionRef={timelineSectionRef}
            onWheel={handleWheel}
            onBackgroundClick={handleBackgroundClick}
          />
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ClipContextMenu
          clip={contextMenu.clip}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSplitClip={handleSplitClipFromMenu}
          onDetachAudio={handleDetachAudio}
          onUnlinkClip={handleUnlinkClip}
          onDuplicate={handleDuplicateClip}
          onDelete={handleDeleteClipFromMenu}
        />
      )}
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
