'use client'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Volume2, Lock, Edit3 } from 'lucide-react'
import { TimelineClip } from '@/app/page'
import { useRef, useEffect } from 'react'

interface TimelineProps {
  clips: TimelineClip[]
  currentTime: number
  onTimeChange: (time: number) => void
  onClipsChange: (clips: TimelineClip[]) => void
  isPlaying: boolean
  onPlayingChange: (playing: boolean) => void
  zoom: number
}

export function Timeline({ 
  clips, 
  currentTime, 
  onTimeChange, 
  onClipsChange,
  isPlaying,
  onPlayingChange,
  zoom 
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const pixelsPerSecond = 50 * (zoom / 100)
  const totalDuration = 12 // seconds

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = (x / pixelsPerSecond)
    onTimeChange(Math.max(0, Math.min(time, totalDuration)))
  }

  const timeMarkers = []
  for (let i = 0; i <= totalDuration; i += 3) {
    timeMarkers.push(i)
  }

  return (
    <div className="h-[280px] bg-[#1a1a1a] border-t border-[#27272a] flex flex-col">
      <div className="flex-1 flex">
        <div className="w-16 border-r border-[#27272a] flex flex-col">
          <div className="flex-1" />
          <div className="h-16 flex flex-col items-center justify-center border-t border-[#27272a] gap-1">
            
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Lock className="h-3 w-3" />
            </Button>
          </div>
          <div className="h-16 flex flex-col items-center justify-center border-t border-[#27272a] gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Volume2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Edit3 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex-1 relative overflow-x-auto">
          <div className="h-12 bg-[#0a0a0a] border-b border-[#27272a] flex items-end px-4 relative">
            {timeMarkers.map((time) => (
              <div 
                key={time}
                className="absolute flex flex-col items-center"
                style={{ left: `${time * pixelsPerSecond}px` }}
              >
                <span className="text-[10px] text-gray-500 mb-1 font-mono">
                  {String(Math.floor(time / 60)).padStart(2, '0')}:
                  {String(time % 60).padStart(2, '0')}
                </span>
                <div className="h-2 w-px bg-gray-700" />
              </div>
            ))}
          </div>

          <div 
            ref={timelineRef}
            className="relative h-[calc(100%-48px)] cursor-pointer"
            onClick={handleTimelineClick}
          >
            {clips.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-block p-4 bg-[#2a2a2a] rounded-lg mb-2">
                    <Edit3 className="h-6 w-6 text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-500">Drag and drop media here</p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-16 border-b border-[#27272a] relative">
                  {clips.filter(c => c.trackId === 'track-1').map((clip) => (
                    <div
                      key={clip.id}
                      className="absolute h-14 rounded bg-gradient-to-r from-amber-600 to-orange-500 border border-amber-400/30 overflow-hidden cursor-move hover:ring-2 hover:ring-cyan-400"
                      style={{
                        left: `${clip.startTime * pixelsPerSecond}px`,
                        width: `${clip.duration * pixelsPerSecond}px`,
                        top: '4px'
                      }}
                    >
                      <div className="h-full flex">
                        {Array.from({ length: Math.ceil(clip.duration) }).map((_, i) => (
                          <img
                            key={i}
                            src={clip.thumbnail || "/placeholder.svg"}
                            alt=""
                            className="h-full w-auto object-cover opacity-60"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="h-16 border-b border-[#27272a] relative">
                  {clips.filter(c => c.trackId === 'track-2').map((clip) => (
                    <div
                      key={clip.id}
                      className="absolute h-14 rounded bg-gradient-to-r from-cyan-600 to-blue-500 border border-cyan-400/30 overflow-hidden cursor-move hover:ring-2 hover:ring-cyan-400"
                      style={{
                        left: `${clip.startTime * pixelsPerSecond}px`,
                        width: `${clip.duration * pixelsPerSecond}px`,
                        top: '4px'
                      }}
                    >
                      <div className="h-full flex">
                        {Array.from({ length: Math.ceil(clip.duration) }).map((_, i) => (
                          <img
                            key={i}
                            src={clip.thumbnail || "/placeholder.svg"}
                            alt=""
                            className="h-full w-auto object-cover opacity-60"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="h-10 bg-[#0a0a0a] border-t border-[#27272a] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            <Edit3 className="h-3 w-3 mr-1" />
            Add Track
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Zoom</span>
          <Slider 
            value={[zoom]} 
            min={25} 
            max={200} 
            step={25}
            className="w-32"
          />
        </div>
      </div>
    </div>
  )
}
