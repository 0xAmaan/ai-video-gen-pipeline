'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { Monitor, Smartphone, Download } from 'lucide-react'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  aspectRatio: '16:9' | '9:16' | '1:1'
}

export function ExportModal({ isOpen, onClose, aspectRatio }: ExportModalProps) {
  const [resolution, setResolution] = useState('1080p')
  const [format, setFormat] = useState('mp4')
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleExport = () => {
    setIsExporting(true)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            setIsExporting(false)
            setProgress(0)
            onClose()
          }, 500)
          return 100
        }
        return prev + 10
      })
    }, 300)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#1a1a1a] border-[#27272a] text-white">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Resolution</Label>
            <RadioGroup value={resolution} onValueChange={setResolution}>
              <div className="flex items-center space-x-2 p-3 bg-[#2a2a2a] rounded-lg hover:bg-[#3a3a3a] cursor-pointer">
                <RadioGroupItem value="720p" id="720p" />
                <Label htmlFor="720p" className="flex-1 cursor-pointer">
                  1280 x 720 (HD)
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-[#2a2a2a] rounded-lg hover:bg-[#3a3a3a] cursor-pointer">
                <RadioGroupItem value="1080p" id="1080p" />
                <Label htmlFor="1080p" className="flex-1 cursor-pointer">
                  1920 x 1080 (Full HD)
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-[#2a2a2a] rounded-lg hover:bg-[#3a3a3a] cursor-pointer">
                <RadioGroupItem value="4k" id="4k" />
                <Label htmlFor="4k" className="flex-1 cursor-pointer">
                  3840 x 2160 (4K)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">Format</Label>
            <RadioGroup value={format} onValueChange={setFormat}>
              <div className="flex items-center space-x-2 p-3 bg-[#2a2a2a] rounded-lg hover:bg-[#3a3a3a] cursor-pointer">
                <RadioGroupItem value="mp4" id="mp4" />
                <Label htmlFor="mp4" className="flex-1 cursor-pointer">MP4 (H.264)</Label>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-[#2a2a2a] rounded-lg hover:bg-[#3a3a3a] cursor-pointer">
                <RadioGroupItem value="mov" id="mov" />
                <Label htmlFor="mov" className="flex-1 cursor-pointer">MOV (ProRes)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="p-4 bg-[#2a2a2a] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Aspect Ratio</span>
              <span className="text-sm font-medium">{aspectRatio}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Estimated Size</span>
              <span className="text-sm font-medium">~45 MB</span>
            </div>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Exporting...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 bg-[#2a2a2a] border-[#3a3a3a] hover:bg-[#3a3a3a]"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button 
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
