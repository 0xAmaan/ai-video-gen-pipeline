'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Monitor, Video, Mic, Square } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface RecordingPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function RecordingPanel({ isOpen, onClose }: RecordingPanelProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#1a1a1a] border-[#27272a] text-white">
        <DialogHeader>
          <DialogTitle>Recording Studio</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-4 py-6">
          <Card className="bg-[#2a2a2a] border-[#3a3a3a] p-6 hover:bg-[#3a3a3a] cursor-pointer transition-colors group">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Monitor className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold mb-1">Screen</h3>
                <p className="text-xs text-gray-400">Record your screen</p>
              </div>
            </div>
          </Card>

          <Card className="bg-[#2a2a2a] border-[#3a3a3a] p-6 hover:bg-[#3a3a3a] cursor-pointer transition-colors group">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Video className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold mb-1">Webcam</h3>
                <p className="text-xs text-gray-400">Record from camera</p>
              </div>
            </div>
          </Card>

          <Card className="bg-[#2a2a2a] border-[#3a3a3a] p-6 hover:bg-[#3a3a3a] cursor-pointer transition-colors group">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mic className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold mb-1">Audio</h3>
                <p className="text-xs text-gray-400">Record voiceover</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-4 border border-[#3a3a3a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center animate-pulse">
                <Square className="h-5 w-5 text-white fill-white" />
              </div>
              <div>
                <div className="text-sm font-medium">Ready to record</div>
                <div className="text-xs text-gray-400">Select a recording type to begin</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            className="flex-1 bg-[#2a2a2a] border-[#3a3a3a] hover:bg-[#3a3a3a]"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
