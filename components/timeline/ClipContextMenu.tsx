"use client";

import { useEffect, useRef } from "react";
import { Scissors, Unlink, Link, Trash2, Copy } from "lucide-react";
import type { Clip } from "@/lib/editor/types";

export interface ClipContextMenuProps {
  clip: Clip;
  x: number;
  y: number;
  onClose: () => void;
  onSplitClip?: (clipId: string) => void;
  onDetachAudio?: (clipId: string) => void;
  onUnlinkClip?: (clipId: string) => void;
  onDuplicate?: (clipId: string) => void;
  onDelete?: (clipId: string) => void;
}

export const ClipContextMenu = ({
  clip,
  x,
  y,
  onClose,
  onSplitClip,
  onDetachAudio,
  onUnlinkClip,
  onDuplicate,
  onDelete,
}: ClipContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const isVideoClip = clip.kind === "video";
  const hasLinkedClip = !!clip.linkedClipId;

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg shadow-xl z-50 py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {/* Split Clip */}
      {onSplitClip && (
        <button
          onClick={() => handleAction(() => onSplitClip(clip.id))}
          className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#3a3a3a] flex items-center gap-2 transition-colors"
        >
          <Scissors className="w-4 h-4" />
          Split Clip
          <span className="ml-auto text-xs text-gray-500">⌘B</span>
        </button>
      )}

      {/* Detach Audio (only for video clips without linked audio) */}
      {onDetachAudio && isVideoClip && !hasLinkedClip && (
        <button
          onClick={() => handleAction(() => onDetachAudio(clip.id))}
          className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#3a3a3a] flex items-center gap-2 transition-colors"
        >
          <Unlink className="w-4 h-4" />
          Detach Audio
        </button>
      )}

      {/* Unlink Clip (only for clips with linked clips) */}
      {onUnlinkClip && hasLinkedClip && (
        <button
          onClick={() => handleAction(() => onUnlinkClip(clip.id))}
          className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#3a3a3a] flex items-center gap-2 transition-colors"
        >
          <Link className="w-4 h-4" />
          Unlink {clip.kind === "video" ? "Audio" : "Video"}
        </button>
      )}

      {/* Separator */}
      {(onDuplicate || onDelete) && (
        <div className="h-px bg-[#3a3a3a] my-1" />
      )}

      {/* Duplicate Clip */}
      {onDuplicate && (
        <button
          onClick={() => handleAction(() => onDuplicate(clip.id))}
          className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#3a3a3a] flex items-center gap-2 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Duplicate
          <span className="ml-auto text-xs text-gray-500">⌘D</span>
        </button>
      )}

      {/* Delete Clip */}
      {onDelete && (
        <button
          onClick={() => handleAction(() => onDelete(clip.id))}
          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[#3a3a3a] flex items-center gap-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
          <span className="ml-auto text-xs text-gray-500">⌫</span>
        </button>
      )}
    </div>
  );
};
