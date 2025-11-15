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
    <div className="flex h-full w-72 flex-col border-r border-border bg-muted/20">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Media</span>
          <label className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary">
            <UploadCloud className="h-4 w-4" />
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
        <div className="space-y-2 p-3">
          {assets.length === 0 && (
            <p className="text-xs text-muted-foreground">Drop files here or import to start editing.</p>
          )}
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onAddToTimeline(asset.id)}
              className="w-full rounded-lg border border-border bg-card p-3 text-left text-xs hover:border-primary"
            >
              <p className="font-semibold text-sm">{asset.name}</p>
              <p className="text-muted-foreground">
                {asset.type} · {asset.width}×{asset.height}
              </p>
              <p className="text-muted-foreground">{asset.duration.toFixed(2)}s</p>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
