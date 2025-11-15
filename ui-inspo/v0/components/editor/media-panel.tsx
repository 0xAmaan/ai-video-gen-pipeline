'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Upload, Smartphone, Monitor, Volume2 } from 'lucide-react'
import { MediaItem } from '@/app/page'

interface MediaPanelProps {
  mediaItems: MediaItem[]
  onFileUpload: (files: FileList | null) => void
  onAddToTimeline: (item: MediaItem) => void
}

export function MediaPanel({ mediaItems, onFileUpload, onAddToTimeline }: MediaPanelProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onFileUpload(e.dataTransfer.files)
  }

  return (
    <div 
      className="w-[300px] bg-[#1a1a1a] border-r border-[#27272a] flex flex-col"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="p-4 border-b border-[#27272a]">
        <Button 
          className="w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white gap-2"
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
        <input
          id="file-upload"
          type="file"
          multiple
          accept="video/*,audio/*"
          className="hidden"
          onChange={(e) => onFileUpload(e.target.files)}
        />
        
        <div className="flex gap-2 mt-3">
          <Button variant="ghost" size="sm" className="flex-1 h-9 bg-[#2a2a2a]">
            <Smartphone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-9 bg-[#2a2a2a]">
            <Monitor className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 border-b border-[#27272a]">
        <Card className="bg-gradient-to-br from-blue-600 to-cyan-600 border-0 p-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Volume2 className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white mb-1">Text to speech</h3>
              <p className="text-xs text-white/80 mb-2">Turn any text into lifelike speech in seconds.</p>
              <Button size="sm" variant="secondary" className="h-7 text-xs">
                Try it →
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {mediaItems.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-8">
            No media yet. Upload files to get started.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {mediaItems.map((item) => (
              <div
                key={item.id}
                className="cursor-pointer group"
                onClick={() => onAddToTimeline(item)}
                draggable
              >
                <div className="relative rounded-lg overflow-hidden bg-[#2a2a2a] aspect-video mb-2">
                  <img 
                    src={item.thumbnail || "/placeholder.svg"} 
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 text-xs px-2 py-0.5 rounded">
                    Added
                  </div>
                  <div className="absolute bottom-2 left-2 bg-black/80 text-xs px-2 py-0.5 rounded font-mono">
                    {item.duration}
                  </div>
                  <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/20 transition-colors" />
                </div>
                <p className="text-xs text-gray-400 truncate">{item.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
