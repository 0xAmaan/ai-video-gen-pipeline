"use client";

import { ArrowRight } from "lucide-react";
import { ShotImage } from "@/lib/types/redesign";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { proxiedImageUrl } from "@/lib/redesign/image-proxy";

interface IterationRowProps {
  iterationNumber: number;
  images: ShotImage[];
  parentImage?: ShotImage | null;
  selectedImageId: Id<"shotImages"> | null;
  onSelectImage: (image: ShotImage) => void;
  onIterateFromImage?: (image: ShotImage) => void;
}

const ImageWithSkeleton = ({
  image,
  alt,
  className,
}: {
  image: ShotImage;
  alt: string;
  className?: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const src = proxiedImageUrl(image.imageUrl);

  return (
    <>
      {isLoading && (
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
      )}
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`${className} transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          crossOrigin="anonymous"
        />
      ) : (
        <div className={`${className} flex items-center justify-center text-xs text-gray-500`}>
          No image
        </div>
      )}
    </>
  );
};

export const IterationRow = ({
  iterationNumber,
  images,
  parentImage,
  selectedImageId,
  onSelectImage,
  onIterateFromImage,
}: IterationRowProps) => {
  if (images.length === 0) {
    return (
      <div className="w-full border border-dashed border-gray-700 rounded-2xl p-6 text-center text-gray-500">
        No images generated for this iteration yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex gap-6">
        {/* Parent Image Column - Only show for iterations > 0 */}
        {iterationNumber > 0 && parentImage && (
          <div className="flex-shrink-0 w-64">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="uppercase tracking-wider">Seed</span>
              </div>
              <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-gray-800/60 bg-gray-900">
                <ImageWithSkeleton
                  image={parentImage}
                  alt={`Parent image for iteration ${iterationNumber}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        )}

        {/* Arrow connector */}
        {iterationNumber > 0 && parentImage && (
          <div className="flex items-center justify-center flex-shrink-0">
            <ArrowRight className="w-6 h-6 text-gray-600" />
          </div>
        )}

        {/* Variants Grid */}
        <div className="flex-1 grid grid-cols-3 gap-6">
          {images.map((image) => {
            const isSelected = selectedImageId === image._id;
            return (
              <div
                key={image._id}
                onClick={() => onSelectImage(image)}
                className={`
                  relative aspect-video rounded-xl overflow-hidden group cursor-pointer
                  transition-all duration-200 border-2 border-gray-800/60
                  ${
                    isSelected
                      ? "ring-4 ring-[var(--color-primary)] scale-[1.02]"
                      : "hover:scale-[1.01] hover:ring-2 hover:ring-gray-500/50"
                  }
                `}
              >
                <ImageWithSkeleton
                  image={image}
                  alt={`Iteration ${iterationNumber} - Variant ${image.variantNumber + 1}`}
                  className="w-full h-full object-cover"
                />

                {isSelected && (
                  <div className="absolute top-3 right-3 bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-full text-sm font-semibold">
                    Selected
                  </div>
                )}
                {onIterateFromImage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIterateFromImage(image);
                    }}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/70 text-xs font-semibold text-white border border-white/10 hover:border-white/30 hover:bg-black/80 transition-colors"
                  >
                    Iterate
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
