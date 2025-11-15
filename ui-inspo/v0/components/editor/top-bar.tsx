'use client'

import { Button } from '@/components/ui/button'
import { Play, RotateCcw, Undo2, Redo2, Settings, Upload, Video, Monitor, Smartphone } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TopBarProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  aspectRatio: '16:9' | '9:16' | '1:1'
  onAspectRatioChange: (ratio: '16:9' | '9:16' | '1:1') => void
  onExport: () => void
  onRecord: () => void
}

export function TopBar({ 
  zoom, 
  onZoomChange, 
  aspectRatio, 
  onAspectRatioChange,
  onExport,
  onRecord 
}: TopBarProps) {
  return (
    <div className="h-[60px] bg-[#1a1a1a] border-b border-[#27272a] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg" />
          <span className="text-sm font-semibold">ClipForge Editor</span>
        </div>
        
        <div className="h-6 w-px bg-[#27272a]" />
        
        <Button variant="ghost" size="sm" className="h-8 gap-2">
          <Monitor className="h-4 w-4" />
          Desktop
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-lg p-1">
          <Button 
            variant={aspectRatio === '16:9' ? 'secondary' : 'ghost'} 
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => onAspectRatioChange('16:9')}
          >
            <Monitor className="h-3 w-3 mr-1" />
            16:9
          </Button>
          <Button 
            variant={aspectRatio === '9:16' ? 'secondary' : 'ghost'} 
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => onAspectRatioChange('9:16')}
          >
            <Smartphone className="h-3 w-3 mr-1" />
            9:16
          </Button>
          <Button 
            variant={aspectRatio === '1:1' ? 'secondary' : 'ghost'} 
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => onAspectRatioChange('1:1')}
          >
            1:1
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Play className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <RotateCcw className="h-4 w-4" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-3">
              {zoom}%
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onZoomChange(50)}>50%</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onZoomChange(75)}>75%</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onZoomChange(100)}>100%</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onZoomChange(150)}>150%</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-[#27272a]" />
        
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Redo2 className="h-4 w-4" />
        </Button>
        
        <div className="h-6 w-px bg-[#27272a]" />

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={onRecord}
        >
          <Video className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
        <Button 
          className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onExport}
        >
          <Upload className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  )
}
