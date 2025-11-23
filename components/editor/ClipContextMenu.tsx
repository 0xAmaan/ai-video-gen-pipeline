"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Activity } from "lucide-react";

interface ClipContextMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: { x: number; y: number };
  clipId: string;
  selectedClipIds: string[];
  playheadTime: number;
  clipStart: number;
  clipEnd: number;
  hasClipboard: boolean;
  hasBeatAnalysis?: boolean;
  isAnalyzing?: boolean;
  canAnalyze?: boolean;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onAnalyzeBeats?: () => void;
  onAutoSplice?: () => void;
  onDelete: () => void;
}

export function ClipContextMenu({
  open,
  onOpenChange,
  position,
  clipId,
  selectedClipIds,
  playheadTime,
  clipStart,
  clipEnd,
  hasClipboard,
  hasBeatAnalysis = false,
  isAnalyzing = false,
  canAnalyze = false,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onSplit,
  onAnalyzeBeats,
  onAutoSplice,
  onDelete,
}: ClipContextMenuProps) {
  // Always allow split if clips are selected (matches industry standard behavior)
  // The split handler will validate if playhead is actually over clips
  const canSplit = selectedClipIds.length > 0;

  // Determine if operating on multiple clips
  const isMultiSelect = selectedClipIds.length > 1;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {/* Hidden trigger - menu is controlled manually */}
      <div style={{ position: 'fixed', left: position.x, top: position.y, width: 0, height: 0 }} />
      <DropdownMenuContent className="w-44" style={{ position: 'fixed', left: position.x, top: position.y }}>
      <DropdownMenuItem onClick={onCut}>
        Cut
        <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onCopy}>
        Copy
        <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onPaste} disabled={!hasClipboard}>
        Paste
        <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onDuplicate}>
        Duplicate{isMultiSelect ? ` (${selectedClipIds.length})` : ""}
        <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem onClick={onSplit} disabled={!canSplit}>
        Split at Playhead
        <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
      </DropdownMenuItem>

      {canAnalyze && onAnalyzeBeats && (
        <DropdownMenuItem onClick={onAnalyzeBeats} disabled={isAnalyzing}>
          <Activity className="mr-2 h-4 w-4" />
          {isAnalyzing ? "Analyzing Beats..." : "Analyze Beats"}
        </DropdownMenuItem>
      )}

      {hasBeatAnalysis && onAutoSplice && (
        <DropdownMenuItem onClick={onAutoSplice}>
          <Activity className="mr-2 h-4 w-4" />
          Auto-Splice on Beats...
        </DropdownMenuItem>
      )}

      <DropdownMenuSeparator />

      <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
        Delete{isMultiSelect ? ` (${selectedClipIds.length})` : ""}
        <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
      </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
