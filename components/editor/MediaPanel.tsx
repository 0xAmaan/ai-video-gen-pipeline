"use client";

import { ScrollArea } from "../ui/scroll-area";
import type { MediaAssetMeta } from "@/lib/editor/types";
import { UploadCloud, Clock } from "lucide-react";

interface MediaPanelProps {
  assets: MediaAssetMeta[];
  onImport: (files: FileList | null) => void;
  onAddToTimeline: (assetId: string) => void;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export const MediaPanel = ({
  assets,
  onImport,
  onAddToTimeline,
}: MediaPanelProps) => {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-medium">Media Library ({assets.length})</span>
        <label className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
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
      <ScrollArea className="flex-1">
        <div className="p-3">
          {assets.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Import files to start editing.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => onAddToTimeline(asset.id)}
                className="group w-full rounded-lg border border-border bg-card overflow-hidden text-left hover:border-primary transition-all hover:shadow-md cursor-pointer"
              >
                {/* Thumbnail container */}
                <div className="relative aspect-video bg-black/50 overflow-hidden">
                  {asset.thumbnails && asset.thumbnails.length > 0 ? (
                    <img
                      src={asset.thumbnails[0]}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <UploadCloud className="h-8 w-8 opacity-30" />
                    </div>
                  )}
                  {/* Duration badge overlay */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/75 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    {formatTime(asset.duration)}
                  </div>
                </div>
                {/* Filename */}
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                    {asset.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
