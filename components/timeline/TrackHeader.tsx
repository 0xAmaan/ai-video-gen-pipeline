"use client";

import { Volume2, VolumeX, Radio, Lock, LockOpen, Eye, EyeOff, MoreVertical } from "lucide-react";
import type { Track } from "@/lib/editor/types";

export interface TrackHeaderProps {
  track: Track;
  onVolumeChange: (trackId: string, volume: number) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onToggleLock: (trackId: string) => void;
  onToggleVisible: (trackId: string) => void;
  onDelete?: (trackId: string) => void;
}

export const TrackHeader = ({
  track,
  onVolumeChange,
  onToggleMute,
  onToggleSolo,
  onToggleLock,
  onToggleVisible,
  onDelete,
}: TrackHeaderProps) => {
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    onVolumeChange(track.id, volume);
  };

  return (
    <div
      className="flex flex-col px-2 py-1.5 bg-[#1e1e1e] border-b border-[#3a3a3a]"
      style={{ height: `${track.height}px` }}
    >
      {/* Track Name and Controls Row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* Track Kind Badge */}
          <div
            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
              track.kind === "video"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-green-500/20 text-green-400"
            }`}
          >
            {track.kind === "video" ? "V" : "A"}
          </div>

          {/* Track Name */}
          <span className="text-xs text-gray-300 truncate font-medium">
            {track.name}
          </span>
        </div>

        {/* More Options */}
        {onDelete && (
          <button
            onClick={() => onDelete(track.id)}
            className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
            title="More options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex items-center gap-1">
        {/* Mute Button */}
        <button
          onClick={() => onToggleMute(track.id)}
          className={`p-1 rounded transition-all ${
            track.muted
              ? "bg-red-500/20 text-red-400"
              : "text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]"
          }`}
          title={track.muted ? "Unmute" : "Mute"}
        >
          {track.muted ? (
            <VolumeX className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Solo Button */}
        <button
          onClick={() => onToggleSolo(track.id)}
          className={`p-1 rounded transition-all ${
            track.solo
              ? "bg-yellow-500/20 text-yellow-400"
              : "text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]"
          }`}
          title={track.solo ? "Unsolo" : "Solo"}
        >
          <Radio className="w-3.5 h-3.5" />
        </button>

        {/* Lock Button */}
        <button
          onClick={() => onToggleLock(track.id)}
          className={`p-1 rounded transition-all ${
            track.locked
              ? "bg-gray-500/20 text-gray-300"
              : "text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]"
          }`}
          title={track.locked ? "Unlock" : "Lock"}
        >
          {track.locked ? (
            <Lock className="w-3.5 h-3.5" />
          ) : (
            <LockOpen className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Visible Button */}
        <button
          onClick={() => onToggleVisible(track.id)}
          className={`p-1 rounded transition-all ${
            !track.visible
              ? "bg-gray-500/20 text-gray-400"
              : "text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]"
          }`}
          title={track.visible ? "Hide" : "Show"}
        >
          {track.visible ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Volume Slider - Only for audio tracks */}
        {track.kind === "audio" && (
          <div className="flex items-center gap-1 ml-1 flex-1">
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={track.volume}
              onChange={handleVolumeChange}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider-thumb"
              title={`Volume: ${Math.round(track.volume * 100)}%`}
            />
            <span className="text-[10px] text-gray-500 font-mono min-w-[32px] text-right">
              {Math.round(track.volume * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
