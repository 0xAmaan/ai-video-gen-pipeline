'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/editor/sidebar'
import { MediaPanel } from '@/components/editor/media-panel'
import { PreviewPanel } from '@/components/editor/preview-panel'
import { Timeline } from '@/components/editor/timeline'
import { TopBar } from '@/components/editor/top-bar'
import { ExportModal } from '@/components/editor/export-modal'
import { RecordingPanel } from '@/components/editor/recording-panel'

export interface MediaItem {
  id: string
  name: string
  duration: string
  thumbnail: string
  type: 'video' | 'audio'
}

export interface TimelineClip {
  id: string
  mediaId: string
  trackId: string
  startTime: number
  duration: number
  trimStart: number
  trimEnd: number
  thumbnail: string
}

export default function EditorPage() {
  const [activeTab, setActiveTab] = useState('media')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isRecordingOpen, setIsRecordingOpen] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9')

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return
    
    Array.from(files).forEach((file, index) => {
      const newItem: MediaItem = {
        id: `media-${Date.now()}-${index}`,
        name: file.name,
        duration: '00:05', // Mock duration
        thumbnail: '/placeholder.svg?height=120&width=160',
        type: file.type.startsWith('video/') ? 'video' : 'audio'
      }
      setMediaItems(prev => [...prev, newItem])
    })
  }

  const handleAddToTimeline = (mediaItem: MediaItem) => {
    const newClip: TimelineClip = {
      id: `clip-${Date.now()}`,
      mediaId: mediaItem.id,
      trackId: 'track-1',
      startTime: timelineClips.length * 5, // Stack clips
      duration: 5,
      trimStart: 0,
      trimEnd: 5,
      thumbnail: mediaItem.thumbnail
    }
    setTimelineClips(prev => [...prev, newClip])
  }

  return (
    <div className="h-screen w-full flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      <TopBar 
        zoom={zoom}
        onZoomChange={setZoom}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        onExport={() => setIsExportOpen(true)}
        onRecord={() => setIsRecordingOpen(true)}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        {activeTab === 'media' && (
          <MediaPanel 
            mediaItems={mediaItems}
            onFileUpload={handleFileUpload}
            onAddToTimeline={handleAddToTimeline}
          />
        )}
        
        <PreviewPanel 
          timelineClips={timelineClips}
          currentTime={currentTime}
          isPlaying={isPlaying}
          aspectRatio={aspectRatio}
          hasContent={timelineClips.length > 0}
        />
      </div>
      
      <Timeline 
        clips={timelineClips}
        currentTime={currentTime}
        onTimeChange={setCurrentTime}
        onClipsChange={setTimelineClips}
        isPlaying={isPlaying}
        onPlayingChange={setIsPlaying}
        zoom={zoom}
      />

      <ExportModal 
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        aspectRatio={aspectRatio}
      />

      <RecordingPanel 
        isOpen={isRecordingOpen}
        onClose={() => setIsRecordingOpen(false)}
      />
    </div>
  )
}
