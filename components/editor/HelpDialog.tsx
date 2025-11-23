"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string;
  description: string;
  note?: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutItem[];
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  // Detect platform for displaying correct modifier keys
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  }, []);

  const modKey = isMac ? '⌘' : 'Ctrl';
  const optKey = isMac ? '⌥' : 'Alt';

  const categories: ShortcutCategory[] = [
    {
      title: "Clip Operations",
      shortcuts: [
        {
          keys: `${modKey}+B`,
          description: "Split clip at playhead",
          note: "Frame-accurate split with property preservation",
        },
        {
          keys: "S",
          description: "Split clip at playhead (legacy)",
          note: "Alternative shortcut for clip splitting",
        },
        {
          keys: "Delete / Backspace",
          description: "Delete selected clip",
          note: "Uses ripple delete when ripple mode is enabled",
        },
      ],
    },
    {
      title: "Ripple Edit Mode",
      shortcuts: [
        {
          keys: "R",
          description: "Toggle Ripple Edit mode",
          note: "When enabled, deleting clips automatically closes gaps",
        },
        {
          keys: "Click '1' / 'ALL' button",
          description: "Toggle single-track / multi-track ripple",
          note: "'1' affects only the clip's track, 'ALL' affects all unlocked tracks",
        },
        {
          keys: "Locked tracks",
          description: "Automatically skipped during ripple",
          note: "Lock a track to prevent it from being affected by ripple operations",
        },
      ],
    },
    {
      title: "Editing Modes",
      shortcuts: [
        {
          keys: `${optKey}+Drag`,
          description: "Slip mode",
          note: "Adjusts content offset, keeps timeline position fixed",
        },
        {
          keys: `${modKey}+${optKey}+Drag`,
          description: "Slide mode",
          note: "Moves clip while preserving gaps with adjacent clips",
        },
        {
          keys: "Escape",
          description: "Cancel slip/slide editing",
          note: "Returns to normal mode",
        },
      ],
    },
    {
      title: "Timeline Controls",
      shortcuts: [
        {
          keys: "Click 'Timeline' button",
          description: "Switch between Twick and Legacy timeline",
        },
        {
          keys: "Click 'RIPPLE' button",
          description: "Toggle ripple edit mode",
        },
        {
          keys: `${modKey}+Z`,
          description: "Undo last action",
        },
        {
          keys: `${modKey}+Shift+Z`,
          description: "Redo action",
        },
      ],
    },
    {
      title: "Media & Export",
      shortcuts: [
        {
          keys: "Click pencil icon",
          description: "Edit project title",
        },
        {
          keys: "Volume slider",
          description: "Adjust master volume",
        },
        {
          keys: "Speaker icon",
          description: "Toggle audio track mute",
        },
        {
          keys: "Export button",
          description: "Export video",
        },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Help & Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Complete reference for all available commands and shortcuts
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category.title}>
                <h3 className="text-sm font-semibold text-foreground mb-3 tracking-wide uppercase">
                  {category.title}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">
                            {shortcut.keys}
                          </kbd>
                          <span className="text-sm text-foreground">
                            {shortcut.description}
                          </span>
                        </div>
                        {shortcut.note && (
                          <p className="text-xs text-muted-foreground mt-1 ml-2">
                            {shortcut.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              💡 Tip: You can also access this help dialog anytime by pressing{" "}
              <kbd className="px-1 py-0.5 text-xs bg-muted border border-border rounded">
                {modKey}+/
              </kbd>
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
