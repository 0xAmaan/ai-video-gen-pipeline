"use client";

import { ScrollArea } from "../ui/scroll-area";
import type { MediaAssetMeta } from "@/lib/editor/types";
import { UploadCloud } from "lucide-react";

interface MediaPanelProps {
  assets: MediaAssetMeta[];
  onImport: (files: FileList | null) => void;
  onAddToTimeline: (assetId: string) => void;
}

export const MediaPanel = ({ assets, onImport, onAddToTimeline }: MediaPanelProps) => {
  return (
    <div className="flex h-full flex-col border-r border-border bg-muted/20">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Media Library</span>
          <label className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary">
            <UploadCloud className="h-3 w-3" />
            Import
            <input
              type="file"
              accept="video/*,audio/*,image/*"
              className="hidden"
              multiple
              onChange={(event) => onImport(event.target.files)}
            />
          </label>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1.5 p-2">
          {assets.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">Import files to start editing.</p>
          )}
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onAddToTimeline(asset.id)}
              className="w-full rounded-md border border-border bg-card p-2 text-left text-xs hover:border-primary transition-colors"
            >
              <p className="font-semibold text-xs truncate">{asset.name}</p>
              <p className="text-muted-foreground text-[10px]">
                {asset.width}×{asset.height}
              </p>
              <p className="text-muted-foreground text-[10px]">{asset.duration.toFixed(1)}s</p>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
