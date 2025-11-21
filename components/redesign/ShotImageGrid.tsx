"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ShotPreviewImage } from "@/lib/types/redesign";
import type { Id } from "@/convex/_generated/dataModel";
import { ImageIcon, Loader2, RefreshCw } from "lucide-react";

interface ShotImageGridProps {
  images?: ShotPreviewImage[];
  isLoading?: boolean;
  selectedImageId?: Id<"shotImages"> | null;
  onSelect?: (image: ShotPreviewImage) => void;
  onIterate?: () => void;
  footer?: React.ReactNode;
}

export const ShotImageGrid = ({
  images,
  isLoading,
  selectedImageId,
  onSelect,
  onIterate,
  footer,
}: ShotImageGridProps) => {
  if (isLoading) {
    return (
      <div className="mt-3 max-w-xs mx-auto">
        <div className="aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="mt-3 border border-dashed border-white/10 rounded-xl p-3 text-center text-xs text-gray-500">
        <p>No preview frames yet.</p>
        <Button
          size="sm"
          className="mt-2 bg-white text-black hover:bg-gray-200"
          onClick={onIterate}
        >
          <RefreshCw className="w-3 h-3 mr-2" />
          Generate previews
        </Button>
      </div>
    );
  }

  // Display single preview image (automatically the master shot)
  const image = images[0];

  return (
    <div className="space-y-2">
      <div className="mt-3 max-w-xs mx-auto">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40">
          {image.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.imageUrl}
              alt="Shot preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <ImageIcon className="w-6 h-6" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/60 text-[10px] uppercase tracking-wide text-gray-200">
            Master Shot
          </div>
        </div>
      </div>
      {footer && <div>{footer}</div>}
    </div>
  );
};
