"use client";

import { ScrollArea } from "../ui/scroll-area";
import type { MediaAssetMeta } from "@/lib/editor/types";
import { UploadCloud, Clock, Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";


interface MediaPanelProps {
  assets: MediaAssetMeta[]; // Fallback for local/legacy mode
  onImport: (files: FileList | null) => void;
  onAddToTimeline: (assetId: string) => void;
  convexProjectId?: Id<"editorProjects"> | null; // Optional Convex project ID
}

interface AssetCardProps {
  asset: MediaAssetMeta;
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

function AssetCard({ asset, onAddToTimeline }: AssetCardProps) {
  return (
    <button
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
  );
}

export const MediaPanel = ({
  assets,
  onImport,
  onAddToTimeline,
  convexProjectId,
}: MediaPanelProps) => {
  // Query Convex for assets if we have a project ID
  const convexAssets = useQuery(
    api.editorAssets.getProjectAssets,
    convexProjectId ? { projectId: convexProjectId } : "skip"
  );

  // Determine which assets to display:
  // - If Convex is connected and has data, use convexAssets
  // - Otherwise fall back to local assets prop
  const isLoadingConvex = convexProjectId && convexAssets === undefined;
  const displayAssets = convexProjectId && convexAssets ? convexAssets : assets;

  // Map Convex asset format to MediaAssetMeta format
  const mappedAssets: MediaAssetMeta[] = displayAssets.map((asset: any) => {
    // Check if this is already a MediaAssetMeta (local) or needs mapping (Convex)
    if ('id' in asset && typeof asset.id === 'string' && !asset._id) {
      // Already in MediaAssetMeta format
      return asset as MediaAssetMeta;
    }
    // Map Convex document to MediaAssetMeta
    return {
      id: asset._id,
      name: asset.name,
      type: asset.type,
      url: asset.url,
      duration: asset.duration,
      thumbnails: asset.thumbnails || [],
      width: asset.width,
      height: asset.height,
      fps: asset.fps,
      waveform: asset.waveform,
      sampleRate: asset.sampleRate,
    };
  });
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-medium">
          Media Library ({isLoadingConvex ? '...' : mappedAssets.length})
        </span>
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
          {isLoadingConvex ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : mappedAssets.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Import files to start editing.
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-2">
            {mappedAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onAddToTimeline={onAddToTimeline}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
