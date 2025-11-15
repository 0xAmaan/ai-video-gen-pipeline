'use client'

import { Button } from '@/components/ui/button'
import { Film, LayoutTemplate, Sparkles, Music, Type, MessageSquare, FileText, Wand2, ArrowLeftRight, Filter, Palette } from 'lucide-react'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

// Extensible sidebar configuration
const sidebarItems = [
  { id: 'media', label: 'Media', icon: Film, enabled: true },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, enabled: false },
  { id: 'elements', label: 'Elements', icon: Sparkles, enabled: false },
  { id: 'audio', label: 'Audio', icon: Music, enabled: false },
  { id: 'text', label: 'Text', icon: Type, enabled: false },
  { id: 'captions', label: 'Captions', icon: MessageSquare, enabled: false },
  { id: 'transcript', label: 'Transcript', icon: FileText, enabled: false },
  { id: 'effects', label: 'Effects', icon: Wand2, enabled: false },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight, enabled: false },
  { id: 'filters', label: 'Filters', icon: Filter, enabled: false },
  { id: 'brand', label: 'Brand Kit', icon: Palette, enabled: false },
]

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <div className="w-16 bg-[#0a0a0a] border-r border-[#27272a] flex flex-col items-center py-4 gap-2">
      {sidebarItems.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id
        
        return (
          <Button
            key={item.id}
            variant="ghost"
            size="icon"
            disabled={!item.enabled}
            className={`w-12 h-12 flex flex-col gap-1 ${
              isActive ? 'bg-[#2a2a2a] text-cyan-400' : 'text-gray-400 hover:text-white'
            } ${!item.enabled ? 'opacity-40' : ''}`}
            onClick={() => item.enabled && onTabChange(item.id)}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[9px] font-medium">{item.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
