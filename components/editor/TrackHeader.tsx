"use client";

import { useState, useRef, useEffect } from "react";
import { Video, AudioWaveform, Eye, EyeOff, Lock, Unlock, Volume2, VolumeX, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import type { Track } from "@/lib/editor/types";

interface TrackHeaderProps {
  track: Track;
  onTrackUpdate: (trackId: string, updates: Partial<Track>) => void;
  onTrackDelete: (trackId: string) => void;
  isSelected?: boolean;
  onSelect?: (trackId: string) => void;
  onDragStart?: (trackId: string, startY: number) => void;
  onDragMove?: (currentY: number) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

export const TrackHeader = ({
  track,
  onTrackUpdate,
  onTrackDelete,
  isSelected = false,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  isDragging = false,
}: TrackHeaderProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Drag handlers for track reordering
  useEffect(() => {
    const dragHandle = dragHandleRef.current;
    if (!dragHandle || !onDragStart || !onDragMove || !onDragEnd) return;

    let isDraggingTrack = false;

    const handleMouseDown = (e: MouseEvent) => {
      // Prevent dragging if track is locked
      if (track.locked) return;

      isDraggingTrack = true;
      const startY = e.clientY;
      onDragStart(track.id, startY);

      // Prevent text selection while dragging
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingTrack) return;
      onDragMove(e.clientY);
    };

    const handleMouseUp = () => {
      if (!isDraggingTrack) return;
      isDraggingTrack = false;
      onDragEnd();
    };

    dragHandle.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      dragHandle.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [track.id, track.locked, onDragStart, onDragMove, onDragEnd]);

  const saveName = () => {
    if (editedName.trim() && editedName !== track.name) {
      onTrackUpdate(track.id, { name: editedName.trim() });
    } else {
      setEditedName(track.name);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveName();
    } else if (e.key === "Escape") {
      setEditedName(track.name);
      setIsEditingName(false);
    }
  };

  const handleTrackClick = () => {
    onSelect?.(track.id);
  };

  return (
    <div
      className={`
        w-[200px] h-[60px] border-r border-b border-zinc-800
        bg-zinc-900 flex px-2 py-1
        ${isSelected ? "bg-zinc-800 border-l-2 border-l-blue-500" : ""}
        ${isDragging ? "opacity-50 shadow-lg" : ""}
        transition-opacity
      `}
      onClick={handleTrackClick}
    >
      {/* Drag Handle */}
      <div
        ref={dragHandleRef}
        className={`
          flex items-center justify-center w-4 flex-shrink-0 mr-1
          ${track.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}
          hover:bg-zinc-700 rounded
        `}
        title={track.locked ? "Track is locked" : "Drag to reorder"}
      >
        <GripVertical className="w-3 h-3 text-zinc-500" />
      </div>

      {/* Track Content */}
      <div className="flex-1 flex flex-col">
        {/* Track Type Icon and Name */}
        <div className="flex items-center gap-1.5 mb-1">
          {track.kind === "video" ? (
            <Video className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          ) : (
            <AudioWaveform className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          )}

        {isEditingName ? (
          <Input
            ref={inputRef}
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={saveName}
            onKeyDown={handleNameKeyDown}
            className="h-5 text-xs px-1 py-0 bg-zinc-800 border-zinc-700"
          />
        ) : (
          <div
            className="text-xs text-zinc-200 truncate flex-1 cursor-text"
            onDoubleClick={() => setIsEditingName(true)}
            title={track.name}
          >
            {track.name}
          </div>
        )}
      </div>

      {/* Controls Row 1: Solo, Mute, Lock, Visibility */}
      <div className="flex items-center gap-1 mb-1">
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${track.solo ? "bg-yellow-600 hover:bg-yellow-700" : "hover:bg-zinc-800"}`}
          onClick={(e) => {
            e.stopPropagation();
            onTrackUpdate(track.id, { solo: !track.solo });
          }}
          title="Solo"
        >
          <span className="text-xs font-bold">S</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${track.muted ? "bg-red-600 hover:bg-red-700" : "hover:bg-zinc-800"}`}
          onClick={(e) => {
            e.stopPropagation();
            onTrackUpdate(track.id, { muted: !track.muted });
          }}
          title="Mute"
        >
          {track.muted ? (
            <VolumeX className="w-3 h-3" />
          ) : (
            <Volume2 className="w-3 h-3" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${track.locked ? "bg-zinc-700 hover:bg-zinc-600" : "hover:bg-zinc-800"}`}
          onClick={(e) => {
            e.stopPropagation();
            onTrackUpdate(track.id, { locked: !track.locked });
          }}
          title="Lock"
        >
          {track.locked ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Unlock className="w-3 h-3" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${!track.visible ? "bg-zinc-700 hover:bg-zinc-600" : "hover:bg-zinc-800"}`}
          onClick={(e) => {
            e.stopPropagation();
            onTrackUpdate(track.id, { visible: !track.visible });
          }}
          title="Visibility"
        >
          {track.visible ? (
            <Eye className="w-3 h-3" />
          ) : (
            <EyeOff className="w-3 h-3" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-red-400 hover:bg-red-900/30 hover:text-red-300 ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete track "${track.name}"?`)) {
              onTrackDelete(track.id);
            }
          }}
          title="Delete Track"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Opacity Slider */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-zinc-500 w-8">
          {Math.round(track.opacity * 100)}%
        </span>
        <Slider
          value={[track.opacity * 100]}
          onValueChange={([value]) => {
            onTrackUpdate(track.id, { opacity: value / 100 });
          }}
          min={0}
          max={100}
          step={1}
          className="flex-1 h-4"
          title="Opacity"
        />
      </div>
      </div>
    </div>
  );
};
