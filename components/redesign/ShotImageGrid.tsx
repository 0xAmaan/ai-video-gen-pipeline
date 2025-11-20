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
      <div className="grid grid-cols-2 gap-2 mt-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="aspect-square rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ))}
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="mt-3 border border-dashed border-white/10 rounded-xl p-3 text-center text-xs text-gray-500">
        <p>No preview frames yet.</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 border-white/20 text-white hover:bg-white/10"
          onClick={onIterate}
        >
          <RefreshCw className="w-3 h-3 mr-2" />
          Generate previews
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 mt-3">
        {images.map((image) => {
          const isSelected = image._id === selectedImageId;
          return (
            <button
              key={image._id}
              onClick={() => onSelect?.(image)}
              className={cn(
                "relative aspect-square rounded-xl overflow-hidden border transition-all",
                "bg-black/40 border-white/10 hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
                isSelected && "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]",
              )}
            >
              {image.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.imageUrl}
                  alt="Shot preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <ImageIcon className="w-5 h-5" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/60 text-[10px] uppercase tracking-wide text-gray-200">
                Variant {image.variantNumber + 1}
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 text-[10px] font-semibold bg-emerald-500 text-black px-2 py-1 rounded-full">
                  Selected
                </div>
              )}
            </button>
          );
        })}
      </div>
      {footer && <div>{footer}</div>}
    </div>
  );
};
