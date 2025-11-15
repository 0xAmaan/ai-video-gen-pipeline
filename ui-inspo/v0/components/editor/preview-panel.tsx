'use client'

import { Button } from '@/components/ui/button'
import { Play, Pause, Volume2, Maximize, Grid3x3, VolumeX, ZoomIn, MessageSquare, Upload, Cloud } from 'lucide-react'
import { TimelineClip } from '@/app/page'

interface PreviewPanelProps {
  timelineClips: TimelineClip[]
  currentTime: number
  isPlaying: boolean
  aspectRatio: '16:9' | '9:16' | '1:1'
  hasContent: boolean
}

export function PreviewPanel({ 
  timelineClips, 
  currentTime, 
  isPlaying, 
  aspectRatio,
  hasContent 
}: PreviewPanelProps) {
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '16:9': return 'aspect-video'
      case '9:16': return 'aspect-[9/16]'
      case '1:1': return 'aspect-square'
    }
  }

  return (
    <div className="flex-1 bg-[#0a0a0a] flex flex-col">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className={`relative ${getAspectRatioClass()} w-full max-w-5xl bg-black rounded-lg overflow-hidden shadow-2xl`}>
          {!hasContent ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-cyan-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/50">
                <Upload className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Click to upload</h3>
              <p className="text-sm text-gray-400 mb-6">Or drag and drop file here</p>
              <div className="flex gap-4">
                <Button variant="ghost" size="sm" className="h-10 bg-[#2a2a2a] hover:bg-[#3a3a3a]">
                  <Cloud className="h-4 w-4 mr-2" />
                  Cloud
                </Button>
                <Button variant="ghost" size="sm" className="h-10 bg-[#2a2a2a] hover:bg-[#3a3a3a]">
                  <Upload className="h-4 w-4 mr-2" />
                  Dropbox
                </Button>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800">
              <img 
                src="/placeholder.svg?height=1080&width=1920"
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>
      </div>

      <div className="h-16 bg-[#1a1a1a] border-t border-[#27272a] flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 bg-white text-black hover:bg-gray-200">
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <span className="text-sm font-mono">
            {String(Math.floor(currentTime / 60)).padStart(2, '0')}:
            {String(Math.floor(currentTime % 60)).padStart(2, '0')}:
            {String(Math.floor((currentTime % 1) * 100)).padStart(2, '0')} 
            <span className="text-gray-500 mx-2">/</span>
            00:00:00
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Volume2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 bg-cyan-500/20 text-cyan-400">
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <VolumeX className="h-4 w-4" />
          </Button>
          <div className="h-5 w-px bg-[#27272a] mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
