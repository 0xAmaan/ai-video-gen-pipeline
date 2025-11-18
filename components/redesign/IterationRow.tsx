"use client";

import { RefreshCw } from "lucide-react";

interface IterationRowProps {
  iterationNumber: number;
  images: string[]; // Array of 6 image URLs (or empty strings for placeholders)
  selectedImageIndex: number | null;
  onSelectImage: (iterationNumber: number, imageIndex: number) => void;
  onIterateFromImage: (iterationNumber: number, imageIndex: number) => void;
}

export const IterationRow = ({
  iterationNumber,
  images,
  selectedImageIndex,
  onSelectImage,
  onIterateFromImage,
}: IterationRowProps) => {
  return (
    <div className="w-full">
      {/* Image Grid - 6 images per row */}
      <div className="grid grid-cols-6 gap-4">
        {[0, 1, 2, 3, 4, 5].map((imageIndex) => (
          <div
            key={imageIndex}
            onClick={() => onSelectImage(iterationNumber, imageIndex)}
            className={`
              relative aspect-video rounded-xl overflow-hidden group cursor-pointer
              transition-all duration-200
              ${
                selectedImageIndex === imageIndex
                  ? "ring-4 ring-[var(--color-primary)] scale-[1.02]"
                  : "hover:scale-[1.01] hover:ring-2 hover:ring-gray-500/50"
              }
            `}
          >
            {images[imageIndex] ? (
              <img
                src={images[imageIndex]}
                alt={`Iteration ${iterationNumber} - Image ${imageIndex + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#171717] flex items-center justify-center border border-gray-800">
                <span className="text-gray-600 text-xs">
                  {imageIndex + 1}
                </span>
              </div>
            )}

            {/* Selection Indicator */}
            {selectedImageIndex === imageIndex && (
              <div className="absolute top-2 right-2 bg-[var(--color-primary)] text-white px-2 py-1 rounded-full text-xs font-semibold">
                Selected
              </div>
            )}

            {/* Iterate Button - Shows on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIterateFromImage(iterationNumber, imageIndex);
                }}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Iterate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
