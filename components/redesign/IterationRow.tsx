"use client";

import { RefreshCw } from "lucide-react";
import { ShotImage } from "@/lib/types/redesign";
import { Id } from "@/convex/_generated/dataModel";

interface IterationRowProps {
  iterationNumber: number;
  images: ShotImage[];
  selectedImageId: Id<"shotImages"> | null;
  onSelectImage: (image: ShotImage) => void;
  onIterateFromImage: (image: ShotImage) => void;
}

export const IterationRow = ({
  iterationNumber,
  images,
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
      <div className="grid grid-cols-3 gap-6">
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
              <img
                src={image.imageUrl}
                alt={`Iteration ${iterationNumber} - Variant ${image.variantNumber + 1}`}
                className="w-full h-full object-cover"
              />

              {isSelected && (
                <div className="absolute top-3 right-3 bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-full text-sm font-semibold">
                  Selected
                </div>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onIterateFromImage(image);
                  }}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Iterate
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
