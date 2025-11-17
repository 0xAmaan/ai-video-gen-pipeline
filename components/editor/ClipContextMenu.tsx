"use client";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";

interface ClipContextMenuProps {
  clipId: string;
  selectedClipIds: string[];
  playheadTime: number;
  clipStart: number;
  clipEnd: number;
  hasClipboard: boolean;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onDelete: () => void;
}

export function ClipContextMenu({
  clipId,
  selectedClipIds,
  playheadTime,
  clipStart,
  clipEnd,
  hasClipboard,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onSplit,
  onDelete,
}: ClipContextMenuProps) {
  // Check if playhead is over this clip for split operation
  const canSplit = playheadTime > clipStart && playheadTime < clipEnd;

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

      <ContextMenuSeparator />

      <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
        Delete{isMultiSelect ? ` (${selectedClipIds.length})` : ""}
        <ContextMenuShortcut>⌫</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
