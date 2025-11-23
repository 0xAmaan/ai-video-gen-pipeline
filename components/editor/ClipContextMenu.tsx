"use client";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { Activity } from "lucide-react";

interface ClipContextMenuProps {
  clipId: string;
  selectedClipIds: string[];
  playheadTime: number;
  clipStart: number;
  clipEnd: number;
  hasClipboard: boolean;
  hasBeatAnalysis?: boolean;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onAutoSplice?: () => void;
  onDelete: () => void;
}

export function ClipContextMenu({
  clipId,
  selectedClipIds,
  playheadTime,
  clipStart,
  clipEnd,
  hasClipboard,
  hasBeatAnalysis = false,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onSplit,
  onAutoSplice,
  onDelete,
}: ClipContextMenuProps) {
  // Always allow split if clips are selected (matches industry standard behavior)
  // The split handler will validate if playhead is actually over clips
  const canSplit = selectedClipIds.length > 0;

  // Determine if operating on multiple clips
  const isMultiSelect = selectedClipIds.length > 1;

  return (
    <ContextMenuContent className="w-44">
      <ContextMenuItem onClick={onCut}>
        Cut
        <ContextMenuShortcut>⌘X</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onCopy}>
        Copy
        <ContextMenuShortcut>⌘C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onPaste} disabled={!hasClipboard}>
        Paste
        <ContextMenuShortcut>⌘V</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onDuplicate}>
        Duplicate{isMultiSelect ? ` (${selectedClipIds.length})` : ""}
        <ContextMenuShortcut>⌘D</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem onClick={onSplit} disabled={!canSplit}>
        Split at Playhead
        <ContextMenuShortcut>⌘B</ContextMenuShortcut>
      </ContextMenuItem>

      {hasBeatAnalysis && onAutoSplice && (
        <ContextMenuItem onClick={onAutoSplice}>
          <Activity className="mr-2 h-4 w-4" />
          Auto-Splice on Beats...
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
        Delete{isMultiSelect ? ` (${selectedClipIds.length})` : ""}
        <ContextMenuShortcut>⌫</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
