"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ShotPreviewImage } from "@/lib/types/redesign";
import type { Id } from "@/convex/_generated/dataModel";
import { ImageIcon, Loader2, Sparkles } from "lucide-react";
import { proxiedImageUrl } from "@/lib/redesign/image-proxy";

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
      <div className="mt-3 text-center pb-4">
        <Button
          size="default"
          variant="outline"
          className="mt-2 inline-flex items-center gap-2 border-white/15 bg-white/5 px-4 py-2.5 text-md font-medium text-white hover:bg-white/10 hover:text-white"
          onClick={onIterate}
        >
          <Sparkles className="w-4 h-4" />
          Generate Previews
        </Button>
      </div>
    );
  }

  // Display single preview image (automatically the master shot)
  const image = images[0];
  const src = proxiedImageUrl(image.imageUrl);

  return (
    <div className="space-y-2">
      <div className="mt-3 max-w-xs mx-auto">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt="Shot preview"
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <ImageIcon className="w-6 h-6" />
            </div>
          )}
        </div>
      </div>
      {footer && <div>{footer}</div>}
    </div>
  );
};
